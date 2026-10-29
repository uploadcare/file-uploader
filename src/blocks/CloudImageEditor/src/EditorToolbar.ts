import type { PropertyValues, TemplateResult } from 'lit';
import { html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { Ref } from 'lit/directives/ref.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import { when } from 'lit/directives/when.js';
import { debounced } from '../../../lit/rate-limited-method';
import { subscription, type Unsubscribe } from '../../../lit/subscription';
import { debounce } from '../../../utils/debounce';
import { batchPreloadImages } from '../../../utils/preloadImage';
import type { FilterSelectEvent } from './EditorFilterControl';
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

  @state()
  public showMainToolbar = true;

  @state()
  public showSubToolbar = false;

  // Passed in from the root (`<uc-cloud-image-editor>`) as plain Lit props —
  // root → single child, not controller state (see the "State scoping principle").
  @property({ attribute: false })
  public tabList: readonly TabIdValue[] = [...ALL_TABS];

  @property({ attribute: false })
  public cropPresetList: CropPresetList = [];

  @property({ attribute: false })
  public imageSize: ImageSize | null = null;

  /** The editor's image container, passed from the root — measured for image preloading. */
  @property({ attribute: false })
  public imageContainer: HTMLElement | null = null;

  /** Follows `editorController.tabId`, derived in `willUpdate`. */
  @state()
  public activeTab: TabIdValue = TabId.CROP;

  @state()
  private _useSliderPanel = true;

  @state()
  private _tooltipVisible = false;

  @state()
  private _operationTooltip: string | null = null;

  // Toolbar-subtree-local state (see `EditorState`) — only this
  // element + its descendant controls/slider read these, so they live as
  // plain Lit state instead of the cross-cutting editor controller. Passed
  // down to descendants as reactive props where they need to read them
  // (`_currentFilter` -> `EditorFilterControl.currentFilter`); descendants
  // report changes back up via bubbling custom events (`FilterSelectEvent`,
  // `OperationSelectEvent`, `ShowAspectRatioListEvent`,
  // `SliderTooltipChangeEvent`).
  @state()
  private _currentFilter: SliderFilter | '' = FAKE_ORIGINAL_FILTER;

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

  private _cancelPreload?: () => void;

  private readonly _debouncedShowLoader = debounce((show: boolean) => {
    this._showLoader = show;
  }, 500);

  // Debounced at 0ms; `@debounced` drops a tick that lands after the editor context released its controller.
  @debounced(0)
  private _updateInfoTooltip(): void {
    const controller = this.editorController;
    const transformations = controller.editorTransformations;
    const currentOperation = this._currentOperation || null;
    let text = '';
    let visible = false;

    if (controller.tabId === TabId.FILTERS) {
      visible = true;
      if (this._currentFilter && transformations.filter?.name === this._currentFilter) {
        const value = transformations.filter?.amount || 100;
        text = `${this._currentFilter} ${value}`;
      } else {
        text = controller.l10n(FAKE_ORIGINAL_FILTER);
      }
    } else if (this.showSubToolbar && controller.tabId === TabId.TUNING && currentOperation) {
      visible = true;
      const value = transformations[currentOperation] || COLOR_OPERATIONS_CONFIG[currentOperation].zero;
      text = `${controller.l10n(currentOperation)} ${value}`;
    }
    if (visible) {
      this._operationTooltip = text;
    }
    this._tooltipVisible = visible;
  }

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

  /** Sets the toolbar-local `showSlider` state and derives `showMainToolbar`/`showSubToolbar`/`_useSliderPanel` from it. */
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

  /** Sets the toolbar-local `showListAspectRatio` state and derives the toolbar visibility from it. */
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

    if (this.editorController.tabId === TabId.CROP) {
      this._setShowListAspectRatio(false);
    }

    if (this.editorController.tabId === TabId.TUNING) {
      this._tooltipVisible = false;
    }
  }

  private _activateTab(id: TabIdValue): void {
    this.editorController.tabId = id;
    // Set here too: a `tabId` write from `updated` lands inside the update that read it, which `SignalWatcher` does
    // not re-run, so `willUpdate` alone would leave `activeTab` behind.
    this.activeTab = id;
    this._syncTabIndicator();
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
    return this.cropPresetList.length >= 3;
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
    return [
      ...(this._hasAspectRatioPicker
        ? [this._renderFreeformControl()]
        : this.cropPresetList.map((preset) => this._renderAspectRatioControl(preset))),
      ...ALL_CROP_OPERATIONS.map((operation) => this._renderCropOperationControl(operation)),
    ];
  }

  private _renderFilterTabControls(): TemplateResult[] {
    return [FAKE_ORIGINAL_FILTER, ...ALL_FILTERS].map((filterId) => this._renderFilterControl(filterId));
  }

  private _renderTuningTabControls(): TemplateResult[] {
    return ALL_COLOR_OPERATIONS.map((operation) => this._renderOperationControl(operation));
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

  private async _preloadEditedImage(): Promise<void> {
    const originalUrl = this.editorController.originalUrl;
    // Preload at the rendered viewer width, measured from the image container
    // the root passes down as a prop (UI-layer plumbing, not a controller state
    // ref). Skip if it isn't laid out yet (width 0).
    const width = this.imageContainer?.offsetWidth ?? 0;
    if (originalUrl && width > 0) {
      const src = await this.whileAdopted(
        this.editorController.proxyUrl(
          viewerImageSrc(
            originalUrl,
            width,
            this.editorController.editorTransformations,
            this.editorController.sourceOperations,
          ),
        ),
      );
      this._cancelPreload?.();
      const { cancel } = batchPreloadImages([src]);

      this._cancelPreload = () => {
        cancel();
        this._cancelPreload = undefined;
      };
    }
  }

  /** @internal */
  @subscription()
  protected _watchState(): Unsubscribe[] {
    const controller = this.editorController;
    return [
      controller.observe(
        'editorTransformations',
        (editorTransformations) => {
          const appliedFilter = editorTransformations.filter?.name;
          if (this._currentFilter !== appliedFilter) {
            this._currentFilter = appliedFilter ?? '';
          }
          this._updateInfoTooltip();
          this.runTask(() => this._preloadEditedImage());
          // The fader reacts to `editorTransformations` itself.
        },
        { immediate: true },
      ),
      // `activeTab` follows `tabId` in `willUpdate`; the tooltip is a debounced side effect.
      controller.observe('tabId', () => this._updateInfoTooltip()),
      controller.observe('loadingImages', (count) => this._debouncedShowLoader(count > 0), { immediate: true }),
    ];
  }

  public constructor() {
    super();

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
    const controller = this.editorControllerOrNull;
    // Before `tabId` is read below: a write after this update read it would not re-render the toolbar.
    const [firstTab] = this.tabList;
    if (controller && changedProperties.has('tabList') && firstTab && !this.tabList.includes(controller.tabId)) {
      controller.tabId = firstTab;
    }
    // Here, not in `render`, so `updated` sees `activeTab` change and re-syncs the tab indicator.
    this.activeTab = controller?.tabId ?? this.activeTab;
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    // Reacts to the root's `tabList`/`imageSize` props.
    const controller = this.editorControllerOrNull;
    if (changedProperties.has('imageSize') && this.imageSize && controller) {
      this._activateTab(controller.tabId);
    }

    if (changedProperties.has('activeTab') || changedProperties.has('tabList')) {
      this.runTask(async () => {
        await this.whileAdopted(this.updateComplete);
        this._syncTabIndicator();
      });
    }
  }

  public override disconnectedCallback(): void {
    window.removeEventListener('resize', this._handleWindowResize);
    super.disconnectedCallback();

    this._setShowSlider(false);
    this._setShowListAspectRatio(false);
  }

  private readonly _handleCancel = (e: MouseEvent): void => {
    this.sendClickEvent(e, {
      action: 'cancel',
    });
    this._cancelPreload?.();
    this.dispatchEvent(new CustomEvent('uc-internal:cancel', { bubbles: true, composed: true }));
  };

  private readonly _handleApply = (e: MouseEvent): void => {
    this.sendClickEvent(e, {
      action: 'apply',
    });
    this.dispatchEvent(
      new CustomEvent<Transformations>('uc-internal:apply', {
        detail: this.editorController.editorTransformations,
        bubbles: true,
        composed: true,
      }),
    );
  };

  private readonly _handleApplySlider = (e: MouseEvent): void => {
    this.sendClickEvent(e, {
      action: 'apply-slider',
      operation: this._sliderRef.value?.selection ?? null,
    });
    const slider = this._sliderRef.value;
    slider?.apply();
    this._onSliderClose();
  };

  private readonly _handleCancelSlider = (e: MouseEvent): void => {
    this.sendClickEvent(e, {
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
    this.sendClickEvent(e, { tabId: id });
    this._activateTab(id);
  };

  /** `EditorFilterControl`'s reported selection: drives the slider, `currentFilter` and the click telemetry. */
  private readonly _handleFilterSelect = (e: FilterSelectEvent): void => {
    const { operation, filter, active, isOriginal, originalEvent } = e;
    const sliderFilter = filter || undefined;

    if (!active) {
      this._sliderRef.value?.setOperation(operation, sliderFilter);
      this._sliderRef.value?.apply();
    } else if (!isOriginal) {
      this._sliderRef.value?.setOperation(operation, sliderFilter);
      this._setShowSlider(true);
    }

    // Read from the slider now: its tooltip only catches up when it renders, after this click.
    this.sendClickEvent(originalEvent, {
      operation: this._sliderRef.value?.selection ?? null,
    });

    this._currentFilter = filter;
    this._updateInfoTooltip();
  };

  /** `EditorOperationControl`'s reported selection: drives the slider, `currentOperation` and the click telemetry. */
  private readonly _handleOperationSelect = (e: OperationSelectEvent): void => {
    // `EditorOperationControl.operation` is only ever '' in its unset default,
    // which is never clicked.
    this._sliderRef.value?.setOperation(e.operation as ColorOperation);
    this._setShowSlider(true);
    this._currentOperation = e.operation;

    this.sendClickEvent(e.originalEvent, {
      operation: this._sliderRef.value?.selection ?? null,
    });

    this._updateInfoTooltip();
  };

  /** `EditorFreeformButtonControl`'s reported click: opens the aspect-ratio list. */
  private readonly _handleShowAspectRatioList = (): void => {
    this._setShowListAspectRatio(true);
  };

  /** `EditorSlider`'s reported live tooltip recompute. */
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
          aria-role="tab"
          aria-controls=${isActive ? `tab_${id}` : ''}
          .selected=${isActive}
          .titleProp=${`a11y-editor-tab-${id}` as const}
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
          class="uc-sub-toolbar"
          .visible=${this.showMainToolbar}
          .styles=${this._subTopToolbarStyles}
        >
          <div class="uc-tab-content-row">
            ${ALL_TABS.map((tabId) => when(this.activeTab === tabId, () => this._renderTabContent(tabId)))}
          </div>
          <div class="uc-controls-row">
            <uc-presence-toggle
              role="tablist"
              class="uc-tab-toggles"
              .visible=${this.tabList.length > 1}
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
                ? html`<div class="uc-list-aspect-ratio">${this.cropPresetList.map((preset) => this._renderAspectRatioControl(preset))}</div>`
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
