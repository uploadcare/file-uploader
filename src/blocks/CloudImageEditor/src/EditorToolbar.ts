import { html } from '@symbiotejs/symbiote';
import { Block } from '../../../abstract/Block';
import { debounce } from '../../../utils/debounce';
import { batchPreloadImages } from '../../../utils/preloadImage';
import { EditorAspectRatioButtonControl, EditorFreeformButtonControl } from './EditorAspectRatioButtonControl';
import { EditorCropButtonControl } from './EditorCropButtonControl';
import { EditorFilterControl } from './EditorFilterControl';
import type { EditorImageCropper } from './EditorImageCropper';
import type { EditorImageFader } from './EditorImageFader';
import { EditorOperationControl } from './EditorOperationControl';
import { type EditorSlider, FAKE_ORIGINAL_FILTER } from './EditorSlider';
import {
  ALL_COLOR_OPERATIONS,
  ALL_CROP_OPERATIONS,
  ALL_FILTERS,
  ALL_TABS,
  COLOR_OPERATIONS_CONFIG,
  type CropOperation,
  TabId,
} from './toolbar-constants';
import type { CropAspectRatio, LoadingOperations, Transformations } from './types';
import { viewerImageSrc } from './util';
import { parseFilterValue } from './utils/parseFilterValue';

type TabIdValue = (typeof TabId)[keyof typeof TabId];

function renderTabToggle(id: TabIdValue): string {
  return html`
    <uc-presence-toggle
      class="uc-tab-toggle"
      bind="visible: presence.tabToggle.${id}; styles: presence.tabToggleStyles;"
    >
      <uc-btn-ui
        theme="tab"
        ref="tab-toggle-${id}"
        data-id="${id}"
        icon="${id}"
        bind="onclick: on.clickTab; aria-role:tab_role; aria-controls:tab_${id}; title-prop: a11y-editor-tab-${id}"
      >
      </uc-btn-ui>
    </uc-presence-toggle>
  `;
}

function renderTabContent(id: TabIdValue): string {
  return html`
    <uc-presence-toggle
      id="tab_${id}"
      class="uc-tab-content"
      bind="visible: presence.tabContent.${id}; styles: presence.tabContentStyles"
    >
      <uc-editor-scroller hidden-scrollbar>
        <div class="uc-controls-list_align">
          <div
            role="listbox"
            aria-orientation="horizontal"
            class="uc-controls-list_inner"
            ref="controls-list-${id}"
          ></div>
        </div>
      </uc-editor-scroller>
    </uc-presence-toggle>
  `;
}

export class EditorToolbar extends Block {
  private _debouncedShowLoader: ReturnType<typeof debounce>;
  private _cancelPreload?: () => void;
  private _updateInfoTooltip: ReturnType<typeof debounce>;

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      '*sliderEl': null,
      '*listAspectRatioEl': null,
      /** @type {import('./types.js').LoadingOperations} */
      '*loadingOperations': new Map(),
      '*showSlider': false,
      '*showListAspectRatio': false,
      hideSliderOrList: false,
      '*currentFilter': FAKE_ORIGINAL_FILTER,
      '*currentOperation': null,
      showLoader: false,
      filters: ALL_FILTERS,
      colorOperations: ALL_COLOR_OPERATIONS,
      cropOperations: ALL_CROP_OPERATIONS,
      '*operationTooltip': null,

      'presence.mainToolbar': true,
      'presence.subToolbar': false,
      'presence.tabToggles': true,
      'presence.tabContent.crop': false,
      'presence.tabContent.tuning': false,
      'presence.tabContent.filters': false,
      'presence.tabToggle.crop': true,
      'presence.tabToggle.tuning': true,
      'presence.tabToggle.filters': true,
      'presence.subTopToolbarStyles': {
        hidden: 'uc-sub-toolbar--top-hidden',
        visible: 'uc-sub-toolbar--visible',
      },
      'presence.subBottomToolbarStyles': {
        hidden: 'uc-sub-toolbar--bottom-hidden',
        visible: 'uc-sub-toolbar--visible',
      },
      'presence.tabContentStyles': {
        hidden: 'uc-tab-content--hidden',
        visible: 'uc-tab-content--visible',
      },
      'presence.tabToggleStyles': {
        hidden: 'uc-tab-toggle--hidden',
        visible: 'uc-tab-toggle--visible',
      },
      'presence.tabTogglesStyles': {
        hidden: 'uc-tab-toggles--hidden',
        visible: 'uc-tab-toggles--visible',
      },
      'on.cancel': (e: MouseEvent) => {
        this.telemetryManager.sendEventCloudImageEditor(e, this.$['*tabId'], {
          action: 'cancel',
        });

        this._cancelPreload?.();
        const onCancel = this.$['*on.cancel'] as () => void;
        onCancel();
      },
      'on.apply': (e: MouseEvent) => {
        this.telemetryManager.sendEventCloudImageEditor(e, this.$['*tabId'], {
          action: 'apply',
        });
        const onApply = this.$['*on.apply'] as (transformations: Transformations) => void;
        onApply(this.$['*editorTransformations'] as Transformations);
      },
      'on.applySlider': (e: MouseEvent) => {
        this.telemetryManager.sendEventCloudImageEditor(e, this.$['*tabId'], {
          action: 'apply-slider',
          operation: parseFilterValue(this.$['*operationTooltip']),
        });
        const slider = this.ref['slider-el'] as EditorSlider;
        slider.apply();
        this._onSliderClose();
      },
      'on.cancelSlider': (e: MouseEvent) => {
        this.telemetryManager.sendEventCloudImageEditor(e, this.$['*tabId'], {
          action: 'cancel-slider',
        });
        const slider = this.ref['slider-el'] as EditorSlider;
        slider.cancel();
        this._onSliderClose();
      },
      'on.clickTab': (e: MouseEvent) => {
        const target = e.currentTarget as HTMLElement | null;
        const id = target?.getAttribute('data-id') as TabIdValue | null;
        if (id) {
          this.telemetryManager.sendEventCloudImageEditor(e, id);
          this._activateTab(id, { fromViewer: false });
        }
      },
      tab_role: 'tab',
      [`tab_${TabId.TUNING}`]: `tab_${TabId.TUNING}`,
      [`tab_${TabId.CROP}`]: `tab_${TabId.CROP}`,
      [`tab_${TabId.FILTERS}`]: `tab_${TabId.FILTERS}`,
      cancel: 'cancel',
      apply: 'apply',
      'a11y-editor-tab-filters': 'a11y-editor-tab-filters',
      'a11y-editor-tab-tuning': 'a11y-editor-tab-tuning',
      'a11y-editor-tab-crop': 'a11y-editor-tab-crop',
    };

    this._debouncedShowLoader = debounce(this._showLoader.bind(this), 500);
    this._updateInfoTooltip = debounce(this._updateInfoTooltipHandler.bind(this), 0);
  }

  private _onSliderClose(): void {
    this.$['*showSlider'] = false;

    if (this.$['*tabId'] === TabId.CROP) {
      this.$['*showListAspectRatio'] = false;
    }

    if (this.$['*tabId'] === TabId.TUNING) {
      const tooltipEl = this.ref['tooltip-el'] as HTMLElement;
      tooltipEl.classList.toggle('uc-info-tooltip_visible', false);
    }
  }

  private _createOperationControl(operation: string): EditorOperationControl {
    const el = new EditorOperationControl();
    (el as unknown as { operation: string }).operation = operation;
    return el;
  }

  private _createFilterControl(filter: string): EditorFilterControl {
    const el = new EditorFilterControl();
    (el as unknown as { filter: string }).filter = filter;
    return el;
  }

  private _createToggleControl(operation: CropOperation): EditorCropButtonControl {
    const el = new EditorCropButtonControl();
    el.operation = operation;
    return el;
  }

  private _createAspectRatioControl(config: CropAspectRatio): EditorAspectRatioButtonControl {
    const el = new EditorAspectRatioButtonControl();
    el.aspectRatio = config;
    return el;
  }

  private _createFreeformControl(): EditorFreeformButtonControl {
    return new EditorFreeformButtonControl();
  }

  private _clearListAspectRatio(): void {
    const listAspectRatioEl = this.$['*listAspectRatioEl'] as HTMLElement | null;
    if (listAspectRatioEl) {
      listAspectRatioEl.innerHTML = '';
    }
  }

  private _renderControlsList(tabId: TabIdValue): void {
    const listEl = this.ref[`controls-list-${tabId}`] as HTMLElement;
    const fr = document.createDocumentFragment();

    this._clearListAspectRatio();

    if (tabId === TabId.CROP) {
      const cropPresetList = this.$['*cropPresetList'] as CropAspectRatio[];
      const hasFreeformAspectRatio = cropPresetList.length >= 3;

      if (hasFreeformAspectRatio) {
        const el = this._createFreeformControl();
        fr.appendChild(el);
      }

      for (const preset of cropPresetList) {
        const el = this._createAspectRatioControl(preset);
        fr.appendChild(el);

        if (hasFreeformAspectRatio) {
          const listAspectRatioEl = this.$['*listAspectRatioEl'] as HTMLElement | null;
          listAspectRatioEl?.appendChild(el);
        }
      }

      for (const operation of this.$.cropOperations as CropOperation[]) {
        const el = this._createToggleControl(operation);
        fr.appendChild(el);
      }
    } else if (tabId === TabId.FILTERS) {
      const filters = this.$.filters as string[];
      [FAKE_ORIGINAL_FILTER, ...filters].forEach((filterId) => {
        const el = this._createFilterControl(filterId);
        fr.appendChild(el);
      });
    } else if (tabId === TabId.TUNING) {
      for (const operation of this.$.colorOperations as string[]) {
        const el = this._createOperationControl(operation);
        fr.appendChild(el);
      }
    }

    [...fr.children].forEach((el, idx) => {
      if (idx === fr.childNodes.length - 1) {
        el.classList.add('uc-controls-list_last-item');
      }
    });

    listEl.innerHTML = '';
    listEl.appendChild(fr);
  }

  private _activateTab(id: TabIdValue, { fromViewer }: { fromViewer?: boolean } = {}): void {
    this.$['*tabId'] = id;

    const faderEl = this.$['*faderEl'] as EditorImageFader | undefined;
    const cropperEl = this.$['*cropperEl'] as EditorImageCropper | undefined;

    if (id === TabId.CROP) {
      faderEl?.deactivate();
      cropperEl?.activate(
        this.$['*imageSize'] as {
          width: number;
          height: number;
        },
        { fromViewer },
      );
    } else {
      faderEl?.activate({
        url: this.$['*originalUrl'] as string,
        fromViewer,
      });
      cropperEl?.deactivate();
    }

    for (const tabId of ALL_TABS) {
      const isCurrentTab = tabId === id;

      const tabToggleEl = this.ref[`tab-toggle-${tabId}`] as HTMLElement & { active: boolean };
      tabToggleEl.active = isCurrentTab;

      if (isCurrentTab) {
        this._renderControlsList(id);
        this._syncTabIndicator();
      } else {
        this._unmountTabControls(tabId);
      }
      this.$[`presence.tabContent.${tabId}`] = isCurrentTab;
    }
  }

  private _unmountTabControls(tabId: TabIdValue): void {
    const listEl = this.ref[`controls-list-${tabId}`] as HTMLElement | undefined;
    if (listEl) {
      listEl.innerHTML = '';
    }
  }

  private _syncTabIndicator(): void {
    const tabToggleEl = this.ref[`tab-toggle-${this.$['*tabId']}`] as HTMLElement;
    const indicatorEl = this.ref['tabs-indicator'] as HTMLElement;
    indicatorEl.style.transform = `translateX(${tabToggleEl.offsetLeft}px)`;
  }

  private async _preloadEditedImage(): Promise<void> {
    if (this.$['*imgContainerEl'] && this.$['*originalUrl']) {
      const width = this.$['*imgContainerEl'].offsetWidth;
      const src = await this.proxyUrl(viewerImageSrc(this.$['*originalUrl'], width, this.$['*editorTransformations']));
      this._cancelPreload?.();
      const { cancel } = batchPreloadImages([src]);
      this._cancelPreload = () => {
        cancel();
        this._cancelPreload = undefined;
      };
    }
  }

  private _showLoader(show: boolean): void {
    this.$.showLoader = show;
  }

  private _updateInfoTooltipHandler(): void {
    const transformations = this.$['*editorTransformations'];
    const currentOperation = this.$['*currentOperation'] as keyof typeof COLOR_OPERATIONS_CONFIG | null;
    let text = '';
    let visible = false;

    if (this.$['*tabId'] === TabId.FILTERS) {
      visible = true;
      if (this.$['*currentFilter'] && transformations?.filter?.name === this.$['*currentFilter']) {
        const value = transformations?.filter?.amount || 100;
        text = `${this.$['*currentFilter']} ${value}`;
      } else {
        text = this.l10n(FAKE_ORIGINAL_FILTER);
      }
    } else if (this.$['*tabId'] === TabId.TUNING && currentOperation) {
      visible = true;
      const value = transformations?.[currentOperation] || COLOR_OPERATIONS_CONFIG[currentOperation].zero;
      text = `${this.l10n(currentOperation)} ${value}`;
    }
    if (visible) {
      this.$['*operationTooltip'] = text;
    }
    this.ref['tooltip-el'].classList.toggle('uc-info-tooltip_visible', visible);
  }

  override initCallback(): void {
    super.initCallback();

    this.$['*sliderEl'] = this.ref['slider-el'];
    this.$['*listAspectRatioEl'] = this.ref['list-el'];

    this.sub('*imageSize', (imageSize: { width: number; height: number } | null) => {
      if (imageSize) {
        setTimeout(() => {
          this._activateTab(this.$['*tabId'], { fromViewer: true });
        }, 0);
      }
    });

    this.sub('*editorTransformations', (editorTransformations: Transformations) => {
      const appliedFilter = editorTransformations?.filter?.name;
      if (this.$['*currentFilter'] !== appliedFilter) {
        this.$['*currentFilter'] = appliedFilter ?? '';
      }
    });

    this.sub('*currentFilter', () => {
      this._updateInfoTooltip();
    });

    this.sub('*currentOperation', () => {
      this._updateInfoTooltip();
    });

    this.sub('*tabId', () => {
      this._updateInfoTooltip();
    });

    this.sub('*originalUrl', () => {
      (this.$['*faderEl'] as EditorImageFader | undefined)?.deactivate();
    });

    this.sub('*editorTransformations', (transformations: Transformations) => {
      this._preloadEditedImage();
      (this.$['*faderEl'] as EditorImageFader | undefined)?.setTransformations(transformations);
    });

    this.sub('*loadingOperations', (loadingOperations: LoadingOperations) => {
      let anyLoading = false;
      for (const [, mapping] of loadingOperations.entries()) {
        if (anyLoading) {
          break;
        }
        for (const [, loading] of mapping.entries()) {
          if (loading) {
            anyLoading = true;
            break;
          }
        }
      }
      this._debouncedShowLoader(anyLoading);
    });

    this.sub('*showSlider', (showSlider: boolean) => {
      this.$['presence.subToolbar'] = showSlider;
      this.$['presence.mainToolbar'] = !showSlider;

      this.$.hideSliderOrList = true;
    });

    this.sub('*showListAspectRatio', (show: boolean) => {
      this.$['presence.subToolbar'] = show;
      this.$['presence.mainToolbar'] = !show;
      this.$.hideSliderOrList = false;
    });

    this.sub('*tabList', (tabList: TabIdValue[]) => {
      this.$['presence.tabToggles'] = tabList.length > 1;
      for (const tabId of ALL_TABS) {
        this.$[`presence.tabToggle.${tabId}`] = tabList.includes(tabId);
        const toggleEl = this.ref[`tab-toggle-${tabId}`] as HTMLElement;
        toggleEl.style.gridColumn = `${tabList.indexOf(tabId) + 1}`;
      }

      if (!tabList.includes(this.$['*tabId']) && tabList.length > 0) {
        const [firstTab] = tabList;
        if (firstTab) {
          this._activateTab(firstTab, { fromViewer: false });
        }
      }
    });

    this._updateInfoTooltip();
  }

  override destroyCallback(): void {
    this.$['*showSlider'] = false;
    this.$['*showListAspectRatio'] = false;
  }
}

EditorToolbar.template = html`
  <uc-line-loader-ui bind="active: showLoader"></uc-line-loader-ui>
  <div class="uc-info-tooltip_container">
    <div class="uc-info-tooltip_wrapper">
      <div ref="tooltip-el" class="uc-info-tooltip uc-info-tooltip_hidden">{{*operationTooltip}}</div>
    </div>
  </div>
  <div class="uc-toolbar-container">
    <uc-presence-toggle
      role="tablist"
      class="uc-sub-toolbar"
      bind="visible: presence.mainToolbar; styles: presence.subTopToolbarStyles"
    >
      <div class="uc-tab-content-row">${ALL_TABS.map(renderTabContent).join('')}</div>
      <div class="uc-controls-row">
        <uc-presence-toggle
          class="uc-tab-toggles"
          bind="visible: presence.tabToggles; styles: presence.tabTogglesStyles"
        >
          <div ref="tabs-indicator" class="uc-tab-toggles_indicator"></div>
          ${ALL_TABS.map(renderTabToggle).join('')}
        </uc-presence-toggle>
        <uc-btn-ui style="order: -1" theme="secondary-icon" icon="closeMax" bind="onclick: on.cancel; title-prop:cancel">
        </uc-btn-ui>
        <uc-btn-ui theme="primary-icon" icon="done" bind="onclick: on.apply; title-prop:apply"> </uc-btn-ui>
      </div>
    </uc-presence-toggle>
    <uc-presence-toggle
      class="uc-sub-toolbar"
      bind="visible: presence.subToolbar; styles: presence.subBottomToolbarStyles"
    >
      <div class="uc-slider" bind="@hidden:!hideSliderOrList">
        <uc-editor-slider ref="slider-el"></uc-editor-slider>
      </div>

      <div bind="@hidden:hideSliderOrList" class="uc-list-aspect-ratio-container">
        <div class="uc-list-aspect-ratio" ref="list-el"></div>
      </div>
      <div class="uc-controls-row">
        <uc-btn-ui theme="secondary" bind="onclick: on.cancelSlider; title-prop:cancel" l10n="@text:cancel"> </uc-btn-ui>
        <uc-btn-ui theme="primary" bind="onclick: on.applySlider; title-prop:apply" l10n="@text:apply"> </uc-btn-ui>
      </div>
    </uc-presence-toggle>
  </div>
`;
