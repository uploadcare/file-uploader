import type { PropertyValues, TemplateResult } from 'lit';
import { html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { Ref } from 'lit/directives/ref.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import { when } from 'lit/directives/when.js';
import { debounce } from '../../../utils/debounce';
import { batchPreloadImages } from '../../../utils/preloadImage';
import type { FilterSelectEvent } from './EditorFilterControl';
import type { EditorImageCropper } from './EditorImageCropper';
import type { EditorImageFader } from './EditorImageFader';
import type { OperationSelectEvent } from './EditorOperationControl';
import {
  type EditorSlider,
  FAKE_ORIGINAL_FILTER,
  type SliderFilter,
  type SliderTooltipChangeEvent,
} from './EditorSlider';
import { EditorBlock } from './editor-context';
import {
  ALL_COLOR_OPERATIONS,
  ALL_CROP_OPERATIONS,
  ALL_FILTERS,
  ALL_TABS,
  COLOR_OPERATIONS_CONFIG,
  type ColorOperation,
  type CropOperation,
  TabId,
} from './toolbar-constants';
import type { CropAspectRatio, CropPresetList, ImageSize, Transformations } from './types';
import { viewerImageSrc } from './util';
import { parseFilterValue } from './utils/parseFilterValue';

import './EditorAspectRatioButtonControl';
import './EditorCropButtonControl';
import './EditorFilterControl';
import './EditorOperationControl';
import './elements/presence-toggle/PresenceToggle';
import './elements/button/BtnUi';
import './EditorScroller';
import './elements/line-loader/LineLoaderUi';
import './EditorSlider';

type TabIdValue = (typeof TabId)[keyof typeof TabId];

export class EditorToolbar extends EditorBlock {
  @state()
  private _showLoader = false;

  // This is public because it's used in the updated lifecycle to assign to the shared state.
  @state()
  public showMainToolbar = true;

  // This is public because it's used in the updated lifecycle to assign to the shared state.
  @state()
  public showSubToolbar = false;

  @state()
  private _showTabToggles = true;

  // Passed in from the root (`<uc-cloud-image-editor>`) as plain Lit props —
  // root → single child, not controller state (see the "State scoping principle").
  @property({ attribute: false })
  public tabList: readonly TabIdValue[] = [...ALL_TABS];

  @property({ attribute: false })
  public cropPresetList: CropPresetList = [];

  @property({ attribute: false })
  public imageSize: ImageSize | null = null;

  // This is public because it's used in the updated lifecycle to assign to the shared state.
  @state()
  public activeTab: TabIdValue = TabId.CROP;

  @state()
  private _useSliderPanel = true;

  @state()
  private _tooltipVisible = false;

  @state()
  private _operationTooltip: string | null = null;

  // Toolbar-subtree-local state (M12 "State scoping principle") — only this
  // element + its descendant controls/slider read these, so they live as
  // plain Lit state instead of the cross-cutting editor controller. Passed
  // down to descendants as reactive props where they need to read them
  // (`_currentFilter` -> `EditorFilterControl.currentFilter`); descendants
  // report changes back up via bubbling custom events (`FilterSelectEvent`,
  // `OperationSelectEvent`, `ShowAspectRatioListEvent`,
  // `SliderTooltipChangeEvent`) instead of the old shared-ctx cross-writes.
  @state()
  private _currentFilter: string = FAKE_ORIGINAL_FILTER;

  @state()
  private _currentOperation: ColorOperation | '' | null = null;

  @state()
  private _showListAspectRatio = false;

  @state()
  private _showSlider = false;

  private _tabIndicatorOffset = 0;
  private _tabIndicatorWidth = 0;

  private readonly _sliderRef = createRef<EditorSlider>();
  private readonly _tabIndicatorRef = createRef<HTMLElement>();
  protected readonly tabToggleRefs: Record<TabIdValue, Ref<HTMLElement>> = {
    [TabId.CROP]: createRef<HTMLElement>(),
    [TabId.TUNING]: createRef<HTMLElement>(),
    [TabId.FILTERS]: createRef<HTMLElement>(),
  };

  private readonly _handleWindowResize = () => {
    this._syncTabIndicator();
  };

  @state()
  private _cropPresets: CropAspectRatio[] = [];

  private _cancelPreload?: () => void;

  private readonly _debouncedShowLoader = debounce((show: boolean) => {
    this._showLoader = show;
  }, 500);

  private readonly _updateInfoTooltip = debounce(() => {
    // Debounced at 0ms: the timer can still fire once after this element has
    // disconnected (and the editor context has released its controller) —
    // bail out rather than throwing.
    const controller = this.editorControllerOrNull;
    if (!controller) {
      return;
    }
    const transformations = controller.get('*editorTransformations');
    const currentOperation = this._currentOperation as keyof typeof COLOR_OPERATIONS_CONFIG | null;
    let text = '';
    let visible = false;

    if (controller.get('*tabId') === TabId.FILTERS) {
      visible = true;
      if (this._currentFilter && transformations?.filter?.name === this._currentFilter) {
        const value = transformations?.filter?.amount || 100;
        text = `${this._currentFilter} ${value}`;
      } else {
        text = controller.l10n(FAKE_ORIGINAL_FILTER);
      }
    } else if (this.showSubToolbar && controller.get('*tabId') === TabId.TUNING && currentOperation) {
      visible = true;
      const value = transformations?.[currentOperation] || COLOR_OPERATIONS_CONFIG[currentOperation].zero;
      text = `${controller.l10n(currentOperation)} ${value}`;
    }
    if (visible) {
      this._operationTooltip = text;
    }
    this._tooltipVisible = visible;
  }, 0);

  private readonly _subTopToolbarStyles = {
    hidden: 'uc-sub-toolbar--top-hidden',
    visible: 'uc-sub-toolbar--visible',
  };

  private readonly _subBottomToolbarStyles = {
    hidden: 'uc-sub-toolbar--bottom-hidden',
    visible: 'uc-sub-toolbar--visible',
  };

  private readonly _tabToggleStyles = {
    hidden: 'uc-tab-toggle--hidden',
    visible: 'uc-tab-toggle--visible',
  };

  private readonly _tabTogglesStyles = {
    hidden: 'uc-tab-toggles--hidden',
    visible: 'uc-tab-toggles--visible',
  };

  /** Sets the toolbar-local `showSlider`/sub-toolbar-visibility state, deriving `showMainToolbar`/`showSubToolbar`/`_useSliderPanel` exactly as the old `sub('*showSlider', ...)` reaction did. */
  private _setShowSlider(show: boolean): void {
    if (Object.is(this._showSlider, show)) {
      return;
    }
    this._showSlider = show;
    if (show) {
      this.showSubToolbar = true;
      this.showMainToolbar = false;
      this._useSliderPanel = true;
    } else if (!this._showListAspectRatio) {
      this.showSubToolbar = false;
      this.showMainToolbar = true;
    }
  }

  /** Sets the toolbar-local `showListAspectRatio` state — mirrors the old `sub('*showListAspectRatio', ...)` reaction. */
  private _setShowListAspectRatio(show: boolean): void {
    if (Object.is(this._showListAspectRatio, show)) {
      return;
    }
    this._showListAspectRatio = show;
    if (show) {
      this.showSubToolbar = true;
      this.showMainToolbar = false;
      this._useSliderPanel = false;
    } else if (!this._showSlider) {
      this.showSubToolbar = false;
      this.showMainToolbar = true;
    }
  }

  private _onSliderClose(): void {
    this._setShowSlider(false);

    if (this.editorController.get('*tabId') === TabId.CROP) {
      this._setShowListAspectRatio(false);
    }

    if (this.editorController.get('*tabId') === TabId.TUNING) {
      this._tooltipVisible = false;
    }
  }

  private _activateTab(
    id: TabIdValue,
    { fromViewer = false, force = false }: { fromViewer?: boolean; force?: boolean } = {},
  ): void {
    if (this.editorController.get('*tabId') !== id) {
      this.editorController.set('*tabId', id);
    }
    this._applyTabState(id, { fromViewer, force });
  }

  private _applyTabState(
    id: TabIdValue,
    { fromViewer, force = false }: { fromViewer: boolean; force?: boolean },
  ): void {
    if (!force && this.activeTab === id) {
      this._syncTabIndicator();
      return;
    }

    this.activeTab = id;

    const faderEl = this.editorController.get('*faderEl') as EditorImageFader | null;
    const cropperEl = this.editorController.get('*cropperEl') as EditorImageCropper | null;

    if (id === TabId.CROP) {
      faderEl?.deactivate();
      const imageSize = this.imageSize;
      if (imageSize) {
        cropperEl?.activate(imageSize, { fromViewer });
      }
    } else {
      faderEl?.activate({
        url: this.editorController.get('*originalUrl') as string,
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
    const indicatorEl = this._tabIndicatorRef.value;
    if (!toggleEl || !indicatorEl) {
      return;
    }
    const offset = toggleEl.offsetLeft;

    const width = toggleEl.offsetWidth || Number(getComputedStyle(toggleEl).width.replace('px', ''));
    if (this._tabIndicatorOffset !== offset || this._tabIndicatorWidth !== width) {
      this._tabIndicatorOffset = offset;
      this._tabIndicatorWidth = width;
      indicatorEl.style.transform = `translateX(${offset}px)`;
      indicatorEl.style.width = `${width}px`;
    }
  }

  private get _hasAspectRatioPicker(): boolean {
    return this._cropPresets.length >= 3;
  }

  private _renderControlsByTab(tabId: TabIdValue): TemplateResult[] {
    switch (tabId) {
      case TabId.CROP:
        return this._renderCropTabControls();
      case TabId.FILTERS:
        return this._renderFilterTabControls();
      case TabId.TUNING:
        return this._renderTuningTabControls();
      default:
        return [];
    }
  }

  private _renderCropTabControls(): TemplateResult[] {
    const renderers: Array<() => TemplateResult> = [];
    if (this._hasAspectRatioPicker) {
      renderers.push(() => this._renderFreeformControl());
    } else {
      for (const preset of this._cropPresets) {
        renderers.push(() => this._renderAspectRatioControl(preset));
      }
    }

    for (const operation of ALL_CROP_OPERATIONS) {
      renderers.push(() => this._renderCropOperationControl(operation));
    }

    return this._renderControlGroup(renderers);
  }

  private _renderFilterTabControls(): TemplateResult[] {
    const filterIds = [FAKE_ORIGINAL_FILTER, ...ALL_FILTERS];
    const renderers = filterIds.map((filterId) => () => this._renderFilterControl(filterId));
    return this._renderControlGroup(renderers);
  }

  private _renderTuningTabControls(): TemplateResult[] {
    const renderers = ALL_COLOR_OPERATIONS.map((operation) => () => this._renderOperationControl(operation));
    return this._renderControlGroup(renderers);
  }

  private _renderControlGroup(renderers: Array<() => TemplateResult>): TemplateResult[] {
    const total = renderers.length;
    if (!total) {
      return [];
    }
    return renderers.map((renderControl) => renderControl());
  }

  private _renderFreeformControl(): TemplateResult {
    return html`<uc-editor-freeform-button-control
      @uc-internal:show-aspect-ratio-list=${this._handleShowAspectRatioList}
    ></uc-editor-freeform-button-control>`;
  }

  private _renderAspectRatioControl(preset: CropAspectRatio): TemplateResult {
    return html`<uc-editor-aspect-ratio-button-control .aspectRatio=${preset}></uc-editor-aspect-ratio-button-control>`;
  }

  private _renderCropOperationControl(operation: CropOperation): TemplateResult {
    return html`<uc-editor-crop-button-control .operation=${operation}></uc-editor-crop-button-control>`;
  }

  private _renderFilterControl(filterId: string): TemplateResult {
    return html`<uc-editor-filter-control
      .filter=${filterId}
      .currentFilter=${this._currentFilter}
      @uc-internal:filter-select=${this._handleFilterSelect}
    ></uc-editor-filter-control>`;
  }

  private _renderOperationControl(operation: ColorOperation | ''): TemplateResult {
    return html`<uc-editor-operation-control
      .operation=${operation}
      @uc-internal:operation-select=${this._handleOperationSelect}
    ></uc-editor-operation-control>`;
  }

  private _renderAspectRatioList(): TemplateResult[] {
    if (!this._hasAspectRatioPicker) {
      return [];
    }
    return this._cropPresets.map((preset) => this._renderAspectRatioControl(preset));
  }

  private async _preloadEditedImage(): Promise<void> {
    const imgContainerEl = this.editorController.get('*imgContainerEl');
    const originalUrl = this.editorController.get('*originalUrl');
    if (imgContainerEl && originalUrl) {
      const width = imgContainerEl.offsetWidth;
      const src = await this.editorController.proxyUrl(
        viewerImageSrc(originalUrl, width, this.editorController.get('*editorTransformations')),
      );
      this._cancelPreload?.();
      const { cancel } = batchPreloadImages([src]);

      this._cancelPreload = () => {
        cancel();
        this._cancelPreload = undefined;
      };
    }
  }

  public constructor() {
    super();

    this.subEditorKey('*editorTransformations', (editorTransformations) => {
      const appliedFilter = editorTransformations?.filter?.name;
      if (this._currentFilter !== appliedFilter) {
        this._currentFilter = appliedFilter ?? '';
      }
      this._updateInfoTooltip();
      this._preloadEditedImage();
      this.editorController.get('*faderEl')?.setTransformations(editorTransformations);
    });

    this.subEditorKey('*tabId', (tabId) => {
      this._applyTabState(tabId, { fromViewer: false, force: true });
      this._updateInfoTooltip();
    });

    this.subEditorKey('*originalUrl', () => {
      this.editorController.get('*faderEl')?.deactivate();
    });

    this.subEditorKey('*loadingOperations', (loadingOperations) => {
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

    this.onEditorAttach(() => {
      this._updateInfoTooltip();
    });
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('resize', this._handleWindowResize);
  }

  public override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);

    this._syncTabIndicator();
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    // Pure derived state from the root-passed props — compute in `willUpdate` so
    // it folds into the current render (no follow-up update scheduled).
    if (changedProperties.has('cropPresetList')) {
      this._cropPresets = [...(this.cropPresetList ?? [])];
    }
    if (changedProperties.has('tabList')) {
      this._showTabToggles = this.tabList.length > 1;
    }
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    // Side effects reacting to the root-passed props (formerly `subEditorKey`
    // subscriptions on the controller) — same transitions → same effects.
    if (changedProperties.has('tabList')) {
      const ctrl = this.editorControllerOrNull;
      if (ctrl && this.tabList.length > 0 && !this.tabList.includes(ctrl.get('*tabId'))) {
        const [firstTab] = this.tabList;
        if (firstTab) {
          this._activateTab(firstTab, { fromViewer: false });
        }
      }
    }

    if (changedProperties.has('imageSize') && this.imageSize) {
      setTimeout(() => {
        this._activateTab(this.editorController.get('*tabId'), { fromViewer: true });
      }, 0);
    }

    if (changedProperties.has('activeTab') || changedProperties.has('tabList')) {
      this.updateComplete.then(() => this._syncTabIndicator());
    }
  }

  public override disconnectedCallback(): void {
    window.removeEventListener('resize', this._handleWindowResize);
    super.disconnectedCallback();

    this._setShowSlider(false);
    this._setShowListAspectRatio(false);
  }

  private readonly _handleCancel = (e: MouseEvent): void => {
    this.editorController.telemetry.sendEventCloudImageEditor(e, this.editorController.get('*tabId'), {
      action: 'cancel',
    });
    this._cancelPreload?.();
    this.dispatchEvent(new CustomEvent('uc-internal:cancel', { bubbles: true, composed: true }));
  };

  private readonly _handleApply = (e: MouseEvent): void => {
    this.editorController.telemetry.sendEventCloudImageEditor(e, this.editorController.get('*tabId'), {
      action: 'apply',
    });
    this.dispatchEvent(
      new CustomEvent<Transformations>('uc-internal:apply', {
        detail: this.editorController.get('*editorTransformations'),
        bubbles: true,
        composed: true,
      }),
    );
  };

  private readonly _handleApplySlider = (e: MouseEvent): void => {
    this.editorController.telemetry.sendEventCloudImageEditor(e, this.editorController.get('*tabId'), {
      action: 'apply-slider',
      operation: parseFilterValue(this._operationTooltip),
    });
    const slider = this._sliderRef.value;
    slider?.apply();
    this._onSliderClose();
  };

  private readonly _handleCancelSlider = (e: MouseEvent): void => {
    this.editorController.telemetry.sendEventCloudImageEditor(e, this.editorController.get('*tabId'), {
      action: 'cancel-slider',
    });
    const slider = this._sliderRef.value;
    slider?.cancel();
    this._onSliderClose();
  };

  private readonly _handleTabClick = (e: MouseEvent): void => {
    const target = e.currentTarget as HTMLElement | null;
    const id = target?.getAttribute('data-id') as TabIdValue | null;
    if (!id) {
      return;
    }
    this.editorController.telemetry.sendEventCloudImageEditor(e, id);
    this._activateTab(id, { fromViewer: false });
  };

  /** `EditorFilterControl`'s reported selection — replaces the old cross-writes to `*sliderEl`/`*showSlider`/`*currentFilter`/`*tabId`-scoped telemetry. */
  private readonly _handleFilterSelect = (e: FilterSelectEvent): void => {
    const { operation, filter, active, isOriginal, originalEvent } = e;
    // `EditorFilterControl.filter` is always a valid `FilterId`/`FAKE_ORIGINAL_FILTER`
    // (bound from `ALL_FILTERS`/`FAKE_ORIGINAL_FILTER` in `_renderFilterTabControls`);
    // narrowing here rather than widening `EditorSlider.setOperation`'s signature.
    const sliderFilter = filter as SliderFilter;

    if (!active) {
      this._sliderRef.value?.setOperation(operation, sliderFilter);
      this._sliderRef.value?.apply();
    } else if (!isOriginal) {
      this._sliderRef.value?.setOperation(operation, sliderFilter);
      this._setShowSlider(true);
    }

    this.editorController.telemetry.sendEventCloudImageEditor(originalEvent, this.editorController.get('*tabId'), {
      operation: parseFilterValue(this._operationTooltip),
    });

    this._currentFilter = filter;
    this._updateInfoTooltip();
  };

  /** `EditorOperationControl`'s reported selection — replaces the old cross-writes to `*sliderEl`/`*showSlider`/`*currentOperation`. */
  private readonly _handleOperationSelect = (e: OperationSelectEvent): void => {
    // `EditorOperationControl.operation` is only ever '' in its unset default
    // (never actually clicked in that state, mirroring the old code's own
    // loosely-typed `*sliderEl` cast at this same boundary).
    this._sliderRef.value?.setOperation(e.operation as ColorOperation);
    this._setShowSlider(true);
    this._currentOperation = e.operation;

    this.editorController.telemetry.sendEventCloudImageEditor(e.originalEvent, this.editorController.get('*tabId'), {
      operation: parseFilterValue(this._operationTooltip),
    });

    this._updateInfoTooltip();
  };

  /** `EditorFreeformButtonControl`'s reported click — replaces the old `$['*showListAspectRatio'] = true` cross-write. */
  private readonly _handleShowAspectRatioList = (): void => {
    this._setShowListAspectRatio(true);
  };

  /** `EditorSlider`'s reported live tooltip recompute — replaces the old `$['*operationTooltip'] = tooltip` cross-write. */
  private readonly _handleSliderTooltipChange = (e: SliderTooltipChangeEvent): void => {
    this._operationTooltip = e.tooltip;
  };

  private _renderTabToggle(id: TabIdValue) {
    const isVisible = this.tabList.includes(id);
    const isActive = this.activeTab === id;
    const columnIndex = this.tabList.indexOf(id);
    const style = columnIndex >= 0 ? styleMap({ gridColumn: `${columnIndex + 1}` }) : nothing;

    return html`
      <uc-presence-toggle class="uc-tab-toggle" .visible=${isVisible} .styles=${this._tabToggleStyles}>
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
          @click=${this._handleTabClick}
          ${ref(this.tabToggleRefs[id])}
        ></uc-btn-ui>
      </uc-presence-toggle>
    `;
  }

  private _renderTabContent(id: TabIdValue) {
    const controls = this._renderControlsByTab(id);

    return html`
      <div
        id=${`tab_${id}`}
        class="uc-tab-content"
      >
        <uc-editor-scroller hidden-scrollbar>
          <div class="uc-controls-list_align">
            <div role="listbox" aria-orientation="horizontal" class="uc-controls-list_inner">
              ${controls.length ? controls : nothing}
            </div>
          </div>
        </uc-editor-scroller>
      </div>
    `;
  }

  public override render() {
    const tooltipClasses = [
      'uc-info-tooltip',
      this._tooltipVisible ? 'uc-info-tooltip_visible' : 'uc-info-tooltip_hidden',
    ].join(' ');
    const showAspectRatioList = this._hasAspectRatioPicker;

    return html`
      <uc-line-loader-ui .active=${this._showLoader}></uc-line-loader-ui>
      <div class="uc-info-tooltip_container">
        <div class="uc-info-tooltip_wrapper">
          <div class=${tooltipClasses}>${this._operationTooltip ?? ''}</div>
        </div>
      </div>
      <div class="uc-toolbar-container">
        <uc-presence-toggle
          role="tablist"
          class="uc-sub-toolbar"
          .visible=${this.showMainToolbar}
          .styles=${this._subTopToolbarStyles}
        >
          <div class="uc-tab-content-row">
            ${ALL_TABS.map((tabId) => when(this.activeTab === tabId, () => this._renderTabContent(tabId)))}
          </div>
          <div class="uc-controls-row">
            <uc-presence-toggle
              class="uc-tab-toggles"
              .visible=${this._showTabToggles}
              .styles=${this._tabTogglesStyles}
              @uc-internal:initial-render=${() => this._syncTabIndicator()}
            >
              <div
                class="uc-tab-toggles_indicator"
                ${ref(this._tabIndicatorRef)}
              ></div>
              ${ALL_TABS.map((tabId) => this._renderTabToggle(tabId))}
            </uc-presence-toggle>
            <uc-btn-ui
              style="order: -1"
              theme="secondary-icon"
              icon="closeMax"
              title-prop="cancel"
              @click=${this._handleCancel}
            ></uc-btn-ui>
            <uc-btn-ui theme="primary-icon" icon="done" title-prop="apply" @click=${this._handleApply}></uc-btn-ui>
          </div>
        </uc-presence-toggle>
        <uc-presence-toggle class="uc-sub-toolbar" .visible=${this.showSubToolbar} .styles=${this._subBottomToolbarStyles}>
          <div class="uc-slider" ?hidden=${!this._useSliderPanel}>
            <uc-editor-slider
              ${ref(this._sliderRef)}
              @uc-internal:slider-tooltip-change=${this._handleSliderTooltipChange}
            ></uc-editor-slider>
          </div>

          <div class="uc-list-aspect-ratio-container" ?hidden=${this._useSliderPanel || !showAspectRatioList}>
            ${
              showAspectRatioList
                ? html`<div class="uc-list-aspect-ratio">${this._renderAspectRatioList()}</div>`
                : nothing
            }
          </div>
          <div class="uc-controls-row">
            <uc-btn-ui
              theme="secondary"
              @click=${this._handleCancelSlider}
              text=${this.l10nSafe('cancel')}
            ></uc-btn-ui>
            <uc-btn-ui
              theme="primary"
              @click=${this._handleApplySlider}
              text=${this.l10nSafe('apply')}
            ></uc-btn-ui>
          </div>
        </uc-presence-toggle>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-toolbar': EditorToolbar;
  }
}
