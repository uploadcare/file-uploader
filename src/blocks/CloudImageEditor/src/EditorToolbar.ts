import type { PropertyValues, TemplateResult } from 'lit';
import { html, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import type { Ref } from 'lit/directives/ref.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LitBlock } from '../../../lit/LitBlock';
import { debounce } from '../../../utils/debounce';
import { batchPreloadImages } from '../../../utils/preloadImage';
import type { EditorImageCropper } from './EditorImageCropper';
import type { EditorImageFader } from './EditorImageFader';
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

export class EditorToolbar extends LitBlock {
  @state()
  private showLoader = false;

  // This is public because it's used in the updated lifecycle to assign to the shared state.
  @state()
  public showMainToolbar = true;

  // This is public because it's used in the updated lifecycle to assign to the shared state.
  @state()
  public showSubToolbar = false;

  @state()
  private showTabToggles = true;

  // This is public because it's used in the updated lifecycle to assign to the shared state.
  @state()
  public tabList: TabIdValue[] = [...ALL_TABS];

  // This is public because it's used in the updated lifecycle to assign to the shared state.
  @state()
  public activeTab: TabIdValue = TabId.CROP;

  @state()
  private useSliderPanel = true;

  @state()
  private tooltipVisible = false;

  @state()
  private operationTooltip: string | null = null;

  private tabIndicatorOffset = 0;
  private tabIndicatorWidth = 0;

  private readonly sliderRef = createRef<EditorSlider>();
  private readonly tabIndicatorRef = createRef<HTMLElement>();
  protected readonly tabToggleRefs: Record<TabIdValue, Ref<HTMLElement>> = {
    [TabId.CROP]: createRef<HTMLElement>(),
    [TabId.TUNING]: createRef<HTMLElement>(),
    [TabId.FILTERS]: createRef<HTMLElement>(),
  };

  private readonly handleWindowResize = () => {
    this._syncTabIndicator();
  };

  @state()
  private cropPresets: CropAspectRatio[] = [];

  private _cancelPreload?: () => void;

  private readonly _debouncedShowLoader = debounce((show: boolean) => {
    this.showLoader = show;
  }, 500);

  private readonly _updateInfoTooltip = debounce(() => {
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
    } else if (this.showSubToolbar && this.$['*tabId'] === TabId.TUNING && currentOperation) {
      visible = true;
      const value = transformations?.[currentOperation] || COLOR_OPERATIONS_CONFIG[currentOperation].zero;
      text = `${this.l10n(currentOperation)} ${value}`;
    }
    if (visible) {
      this.$['*operationTooltip'] = text;
    }
    this.tooltipVisible = visible;
  }, 0);

  private readonly subTopToolbarStyles = {
    hidden: 'uc-sub-toolbar--top-hidden',
    visible: 'uc-sub-toolbar--visible',
  };

  private readonly subBottomToolbarStyles = {
    hidden: 'uc-sub-toolbar--bottom-hidden',
    visible: 'uc-sub-toolbar--visible',
  };

  private readonly tabContentStyles = {
    hidden: 'uc-tab-content--hidden',
    visible: 'uc-tab-content--visible',
  };

  private readonly tabToggleStyles = {
    hidden: 'uc-tab-toggle--hidden',
    visible: 'uc-tab-toggle--visible',
  };

  private readonly tabTogglesStyles = {
    hidden: 'uc-tab-toggles--hidden',
    visible: 'uc-tab-toggles--visible',
  };

  public override init$: Record<string, unknown> = {
    ...this.init$,
    '*sliderEl': null,
    '*showSlider': false,
    '*showListAspectRatio': false,
    '*currentFilter': FAKE_ORIGINAL_FILTER,
    '*currentOperation': null,
    '*operationTooltip': null,
  };

  private _onSliderClose(): void {
    this.$['*showSlider'] = false;

    if (this.$['*tabId'] === TabId.CROP) {
      this.$['*showListAspectRatio'] = false;
    }

    if (this.$['*tabId'] === TabId.TUNING) {
      this.tooltipVisible = false;
    }
  }

  private _activateTab(
    id: TabIdValue,
    { fromViewer = false, force = false }: { fromViewer?: boolean; force?: boolean } = {},
  ): void {
    if (this.$['*tabId'] !== id) {
      this.$['*tabId'] = id;
    }
    this.applyTabState(id, { fromViewer, force });
  }

  private applyTabState(id: TabIdValue, { fromViewer, force = false }: { fromViewer: boolean; force?: boolean }): void {
    if (!force && this.activeTab === id) {
      this._syncTabIndicator();
      return;
    }

    this.activeTab = id;

    const faderEl = this.$['*faderEl'] as EditorImageFader | undefined;
    const cropperEl = this.$['*cropperEl'] as EditorImageCropper | undefined;

    if (id === TabId.CROP) {
      faderEl?.deactivate();
      const imageSize = this.$['*imageSize'] as { width: number; height: number } | undefined;
      if (imageSize) {
        cropperEl?.activate(this.$['*imageSize'] as { width: number; height: number }, { fromViewer });
      }
    } else {
      faderEl?.activate({
        url: this.$['*originalUrl'] as string,
        fromViewer,
      });
      cropperEl?.deactivate();
    }

    for (const tabId of ALL_TABS) {
      const isCurrentTab = tabId === id;
      const toggleRef = this.tabToggleRefs[tabId];
      const toggleEl = toggleRef?.value as (HTMLElement & { active?: boolean }) | null;
      if (toggleEl) {
        toggleEl.active = isCurrentTab;
      }
      if (isCurrentTab) {
        this._syncTabIndicator();
      }
    }
  }

  private _syncTabIndicator(): void {
    const toggleRef = this.tabToggleRefs[this.activeTab];
    const toggleEl = toggleRef?.value;
    const indicatorEl = this.tabIndicatorRef.value;
    if (!toggleEl || !indicatorEl) {
      return;
    }
    const offset = toggleEl.offsetLeft;

    const width = toggleEl.offsetWidth || Number(getComputedStyle(toggleEl).width.replace('px', ''));
    if (this.tabIndicatorOffset !== offset || this.tabIndicatorWidth !== width) {
      this.tabIndicatorOffset = offset;
      this.tabIndicatorWidth = width;
      indicatorEl.style.transform = `translateX(${offset}px)`;
      indicatorEl.style.width = `${width}px`;
    }
  }

  private get hasAspectRatioPicker(): boolean {
    return this.cropPresets.length >= 3;
  }

  private renderControlsByTab(tabId: TabIdValue): TemplateResult[] {
    switch (tabId) {
      case TabId.CROP:
        return this.renderCropTabControls();
      case TabId.FILTERS:
        return this.renderFilterTabControls();
      case TabId.TUNING:
        return this.renderTuningTabControls();
      default:
        return [];
    }
  }

  private renderCropTabControls(): TemplateResult[] {
    const renderers: Array<() => TemplateResult> = [];
    if (this.hasAspectRatioPicker) {
      renderers.push(() => this.renderFreeformControl());
    } else {
      for (const preset of this.cropPresets) {
        renderers.push(() => this.renderAspectRatioControl(preset));
      }
    }

    for (const operation of ALL_CROP_OPERATIONS) {
      renderers.push(() => this.renderCropOperationControl(operation));
    }

    return this.renderControlGroup(renderers);
  }

  private renderFilterTabControls(): TemplateResult[] {
    const filterIds = [FAKE_ORIGINAL_FILTER, ...ALL_FILTERS];
    const renderers = filterIds.map((filterId) => () => this.renderFilterControl(filterId));
    return this.renderControlGroup(renderers);
  }

  private renderTuningTabControls(): TemplateResult[] {
    const renderers = ALL_COLOR_OPERATIONS.map((operation) => () => this.renderOperationControl(operation));
    return this.renderControlGroup(renderers);
  }

  private renderControlGroup(renderers: Array<() => TemplateResult>): TemplateResult[] {
    const total = renderers.length;
    if (!total) {
      return [];
    }
    return renderers.map((renderControl) => renderControl());
  }

  private renderFreeformControl(): TemplateResult {
    return html`<uc-editor-freeform-button-control></uc-editor-freeform-button-control>`;
  }

  private renderAspectRatioControl(preset: CropAspectRatio): TemplateResult {
    return html`<uc-editor-aspect-ratio-button-control .aspectRatio=${preset}></uc-editor-aspect-ratio-button-control>`;
  }

  private renderCropOperationControl(operation: CropOperation): TemplateResult {
    return html`<uc-editor-crop-button-control .operation=${operation}></uc-editor-crop-button-control>`;
  }

  private renderFilterControl(filterId: string): TemplateResult {
    return html`<uc-editor-filter-control .filter=${filterId}></uc-editor-filter-control>`;
  }

  private renderOperationControl(operation: string): TemplateResult {
    return html`<uc-editor-operation-control .operation=${operation}></uc-editor-operation-control>`;
  }

  private renderAspectRatioList(): TemplateResult[] {
    if (!this.hasAspectRatioPicker) {
      return [];
    }
    return this.cropPresets.map((preset) => this.renderAspectRatioControl(preset));
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

  public override initCallback(): void {
    super.initCallback();

    const initialCropPresets = (this.$['*cropPresetList'] as CropAspectRatio[]) ?? [];
    this.cropPresets = [...initialCropPresets];
    this.sub('*cropPresetList', (cropPresetList: CropAspectRatio[]) => {
      this.cropPresets = [...(cropPresetList ?? [])];
    });

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

    this.sub('*tabId', (tabId: TabIdValue) => {
      this.applyTabState(tabId, { fromViewer: false, force: true });
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
      if (showSlider) {
        this.showSubToolbar = true;
        this.showMainToolbar = false;
        this.useSliderPanel = true;
      } else if (!this.$['*showListAspectRatio']) {
        this.showSubToolbar = false;
        this.showMainToolbar = true;
      }
    });

    this.sub('*showListAspectRatio', (show: boolean) => {
      if (show) {
        this.showSubToolbar = true;
        this.showMainToolbar = false;
        this.useSliderPanel = false;
      } else if (!this.$['*showSlider']) {
        this.showSubToolbar = false;
        this.showMainToolbar = true;
      }
    });

    this.sub('*tabList', (tabList: TabIdValue[]) => {
      this.tabList = tabList;
      this.showTabToggles = tabList.length > 1;

      if (!tabList.includes(this.$['*tabId']) && tabList.length > 0) {
        const [firstTab] = tabList;
        if (firstTab) {
          this._activateTab(firstTab, { fromViewer: false });
        }
        return;
      }

      this._syncTabIndicator();
    });

    this.sub('*operationTooltip', (tooltip: string | null) => {
      this.operationTooltip = tooltip;
    });

    this._updateInfoTooltip();
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('resize', this.handleWindowResize);
  }

  public override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);
    this.assignSharedElements();

    this._syncTabIndicator();
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (changedProperties.has('activeTab') || changedProperties.has('tabList')) {
      this.updateComplete.then(() => this._syncTabIndicator());
    }

    if (changedProperties.has('showSubToolbar') || changedProperties.has('showMainToolbar')) {
      this.assignSharedElements();
    }
  }

  public override disconnectedCallback(): void {
    window.removeEventListener('resize', this.handleWindowResize);
    super.disconnectedCallback();

    this.$['*showSlider'] = false;
    this.$['*showListAspectRatio'] = false;
  }

  private assignSharedElements(): void {
    const slider = this.sliderRef.value;
    if (slider) {
      this.$['*sliderEl'] = slider;
    }
  }

  private handleCancel = (e: MouseEvent): void => {
    this.telemetryManager.sendEventCloudImageEditor(e, this.$['*tabId'], {
      action: 'cancel',
    });
    this._cancelPreload?.();
    const onCancel = this.$['*on.cancel'] as (() => void) | undefined;
    onCancel?.();
  };

  private handleApply = (e: MouseEvent): void => {
    this.telemetryManager.sendEventCloudImageEditor(e, this.$['*tabId'], {
      action: 'apply',
    });
    const onApply = this.$['*on.apply'] as ((transformations: Transformations) => void) | undefined;
    onApply?.(this.$['*editorTransformations'] as Transformations);
  };

  private handleApplySlider = (e: MouseEvent): void => {
    this.telemetryManager.sendEventCloudImageEditor(e, this.$['*tabId'], {
      action: 'apply-slider',
      operation: parseFilterValue(this.$['*operationTooltip']),
    });
    const slider = this.sliderRef.value;
    slider?.apply();
    this._onSliderClose();
  };

  private handleCancelSlider = (e: MouseEvent): void => {
    this.telemetryManager.sendEventCloudImageEditor(e, this.$['*tabId'], {
      action: 'cancel-slider',
    });
    const slider = this.sliderRef.value;
    slider?.cancel();
    this._onSliderClose();
  };

  private handleTabClick = (e: MouseEvent): void => {
    const target = e.currentTarget as HTMLElement | null;
    const id = target?.getAttribute('data-id') as TabIdValue | null;
    if (!id) {
      return;
    }
    this.telemetryManager.sendEventCloudImageEditor(e, id);
    this._activateTab(id, { fromViewer: false });
  };

  private renderTabToggle(id: TabIdValue) {
    const isVisible = this.tabList.includes(id);
    const isActive = this.activeTab === id;
    const columnIndex = this.tabList.indexOf(id);
    const style = columnIndex >= 0 ? styleMap({ gridColumn: `${columnIndex + 1}` }) : nothing;

    return html`
      <uc-presence-toggle class="uc-tab-toggle" .visible=${isVisible} .styles=${this.tabToggleStyles}>
        <uc-btn-ui
          theme="tab"
          data-id=${id}
          icon=${id}
          role="tab"
          aria-controls=${`tab_${id}`}
          aria-selected=${isActive ? 'true' : 'false'}
          title-prop=${`a11y-editor-tab-${id}`}
          .active=${isActive}
          style=${style}
          @click=${this.handleTabClick}
          ${ref(this.tabToggleRefs[id])}
        ></uc-btn-ui>
      </uc-presence-toggle>
    `;
  }

  private renderTabContent(id: TabIdValue) {
    const isVisible = this.activeTab === id;
    const controls = this.renderControlsByTab(id);

    return html`
      <uc-presence-toggle
        id=${`tab_${id}`}
        class="uc-tab-content"
        .visible=${isVisible}
        .styles=${this.tabContentStyles}
      >
        <uc-editor-scroller hidden-scrollbar>
          <div class="uc-controls-list_align">
            <div role="listbox" aria-orientation="horizontal" class="uc-controls-list_inner">
              ${controls.length ? controls : nothing}
            </div>
          </div>
        </uc-editor-scroller>
      </uc-presence-toggle>
    `;
  }

  public override render() {
    const tooltipClasses = [
      'uc-info-tooltip',
      this.tooltipVisible ? 'uc-info-tooltip_visible' : 'uc-info-tooltip_hidden',
    ].join(' ');
    const showAspectRatioList = this.hasAspectRatioPicker;

    return html`
      <uc-line-loader-ui .active=${this.showLoader}></uc-line-loader-ui>
      <div class="uc-info-tooltip_container">
        <div class="uc-info-tooltip_wrapper">
          <div class=${tooltipClasses}>${this.operationTooltip ?? ''}</div>
        </div>
      </div>
      <div class="uc-toolbar-container">
        <uc-presence-toggle
          role="tablist"
          class="uc-sub-toolbar"
          .visible=${this.showMainToolbar}
          .styles=${this.subTopToolbarStyles}
        >
          <div class="uc-tab-content-row">
            ${ALL_TABS.map((tabId) => this.renderTabContent(tabId))}
          </div>
          <div class="uc-controls-row">
            <uc-presence-toggle
              class="uc-tab-toggles"
              .visible=${this.showTabToggles}
              .styles=${this.tabTogglesStyles}
              @initial-render=${() => this._syncTabIndicator()}
            >
              <div
                class="uc-tab-toggles_indicator"
                ${ref(this.tabIndicatorRef)}
              ></div>
              ${ALL_TABS.map((tabId) => this.renderTabToggle(tabId))}
            </uc-presence-toggle>
            <uc-btn-ui
              style="order: -1"
              theme="secondary-icon"
              icon="closeMax"
              title-prop="cancel"
              @click=${this.handleCancel}
            ></uc-btn-ui>
            <uc-btn-ui theme="primary-icon" icon="done" title-prop="apply" @click=${this.handleApply}></uc-btn-ui>
          </div>
        </uc-presence-toggle>
        <uc-presence-toggle class="uc-sub-toolbar" .visible=${this.showSubToolbar} .styles=${this.subBottomToolbarStyles}>
          <div class="uc-slider" ?hidden=${!this.useSliderPanel}>
            <uc-editor-slider ${ref(this.sliderRef)}></uc-editor-slider>
          </div>

          <div class="uc-list-aspect-ratio-container" ?hidden=${this.useSliderPanel || !showAspectRatioList}>
            ${
              showAspectRatioList
                ? html`<div class="uc-list-aspect-ratio">${this.renderAspectRatioList()}</div>`
                : nothing
            }
          </div>
          <div class="uc-controls-row">
            <uc-btn-ui theme="secondary" @click=${this.handleCancelSlider} text=${this.l10n('cancel')}></uc-btn-ui>
            <uc-btn-ui theme="primary" @click=${this.handleApplySlider} text=${this.l10n('apply')}></uc-btn-ui>
          </div>
        </uc-presence-toggle>
      </div>
    `;
  }
}
