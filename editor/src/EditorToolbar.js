import { applyElementStyles } from '../../symbiote/core/css_utils.js';
import { ucIconHtml } from './icons/ucIconHtml.js';
import { AppComponent } from './AppComponent.js';
// import { BREAKPOINTS } from '../../shared-styles/design-system.js';
import { ALL_COLOR_OPERATIONS, ALL_FILTERS, ALL_CROP_OPERATIONS, TabId, TABS } from './toolbar-constants.js';
import { EditorOperationControl } from './EditorOperationControl.js';
import { STYLES, COND } from './toolbar-styles.js';
import { EditorCropButtonControl } from './EditorCropButtonControl.js';
import { viewerImageSrc } from './viewer_util.js';
import { batchPreloadImages } from './lib/preloadImage.js';
import { LineLoaderUi } from './elements/line-loader/LineLoaderUi.js';
import { EditorSlider, FAKE_ORIGINAL_FILTER } from './EditorSlider.js';
import { EditorFilterControl } from './EditorFilterControl.js';
import { UcBtnUi } from './elements/button/UcBtnUi.js';
import { PresenceToggle } from './elements/presence-toggle/PresenceToggle.js';
import { EditorScroller } from './EditorScroller.js';
import { debounce } from './lib/debounce.js';

function renderTabToggle(id) {
  return /*html*/ `
    <${UcBtnUi.is} theme="boring" ref="tab-toggle-${id}" data-id="${id}" icon="${id}" tabindex="0" set="ariaClick: on.clickTab;">
    </${UcBtnUi.is}>
  `;
}

function renderTabContent(id) {
  return /*html*/ `
    <${PresenceToggle.is} css="tab-content" set="visible: presence.tabContent${id}">
        <${EditorScroller.is} hidden-scrollbar>
          <div css="controls-list_align">
            <div css="controls-list_inner" ref="controls-list-${id}">
            </div>
          </div>
        </${EditorScroller.is}>
    </${PresenceToggle.is}>
  `;
}

export class EditorToolbar extends AppComponent {
  constructor() {
    super();

    // TODO: investigate TS error:
    // @ts-ignore
    this.state = {
      ctxProvider: this,
      faderEl: null,
      loadingOperations: {},
      showLoader: false,
      showSlider: false,
      originalUrl: null,
      /** @type {import('../../../src/types/UploadEntry.js').Transformations} */
      editorTransformations: {},
      tabId: TabId.CROP,
      currentFilter: FAKE_ORIGINAL_FILTER,
      currentOperation: null,
      filters: ALL_FILTERS,
      colorOperations: ALL_COLOR_OPERATIONS,
      cropOperations: ALL_CROP_OPERATIONS,
      operationTooltip: null,
      networkProblems: false,

      'css.operationTooltip': COND.operation_tooltip_hidden,

      'presence.mainToolbar': true,
      'presence.subToolbar': false,
      [`presence.tabContent${TabId.CROP}`]: false,
      [`presence.tabContent${TabId.SLIDERS}`]: false,
      [`presence.tabContent${TabId.FILTERS}`]: false,
      'presence.subTopToolbarStyles': {
        hidden: STYLES['sub-toolbar--top-hidden'],
        visible: STYLES['sub-toolbar--visible'],
      },
      'presence.subBottomToolbarStyles': {
        hidden: STYLES['sub-toolbar--bottom-hidden'],
        visible: STYLES['sub-toolbar--visible'],
      },
      'on.cancel': (e) => {
        this._cancel();
        this.read('*on.close')();
      },
      'on.apply': (e) => {
        this._apply();
        this.read('*on.close')();
      },
      'on.applySlider': (e) => {
        this['slider-el'].apply();
        this._onSliderClose();
      },
      'on.cancelSlider': (e) => {
        this['slider-el'].cancel();
        this._onSliderClose();
      },
      'on.clickTab': (e) => {
        let id = e.currentTarget.getAttribute('data-id');
        this._activateTab(id, { fromViewer: false });
      },
    };

    this.defineAccessor('imgContainerEl', (el) => {
      this._imgContainerEl = el;
    });

    this.defineAccessor('faderEl', (el) => {
      if (el) {
        /** @type {import('./EditorImageFader').EditorImageFader} */
        this.state.faderEl = el;
      }
    });

    this.defineAccessor('cropperEl', (el) => {
      /** @type {import('./EditorImageCropper').EditorImageCropper} */
      this._cropperEl = el;
    });

    this._debouncedShowLoader = debounce(this._showLoader.bind(this), 500);
  }

  get tabId() {
    return this.state.tabId;
  }

  _onSliderClose() {
    this.state.showSlider = false;
    if (this.state.tabId === TabId.SLIDERS) {
      this.state['css.operationTooltip'] = COND.operation_tooltip_hidden;
    }
  }

  _cancel() {
    this._cancelPreload && this._cancelPreload();
    this.state.editorTransformations = this.read('*transformations');
  }

  _apply() {
    this.pub('*transformations', this.state.editorTransformations);
  }

  /** @param {string} operation */
  _createOperationControl(operation) {
    let el = EditorOperationControl.is && new EditorOperationControl();
    el.dataCtxProvider = this;
    el['faderEl'] = this.state.faderEl;
    el['sliderEl'] = this['slider-el'];
    el['operation'] = operation;
    return el;
  }

  /** @param {string} filter */
  _createFilterControl(filter) {
    let el = EditorFilterControl.is && new EditorFilterControl();
    el.dataCtxProvider = this;
    el['faderEl'] = this.state.faderEl;
    el['sliderEl'] = this['slider-el'];
    el['filter'] = filter;
    return el;
  }

  _createToggleControl(operation) {
    let el = EditorCropButtonControl.is && new EditorCropButtonControl();
    el.dataCtxProvider = this;
    el['cropperEl'] = this._cropperEl;
    el['operation'] = operation;
    return el;
  }

  /** @param {string} tabId */
  _renderControlsList(tabId) {
    let listEl = this[`controls-list-${tabId}`];
    let fr = document.createDocumentFragment();

    if (tabId === TabId.CROP) {
      this.state.cropOperations.forEach((operation) => {
        let el = this._createToggleControl(operation);
        // @ts-ignore
        fr.appendChild(el);
      });
    } else if (tabId === TabId.FILTERS) {
      [FAKE_ORIGINAL_FILTER, ...this.state.filters].forEach((filterId) => {
        let el = this._createFilterControl(filterId);
        // @ts-ignore
        fr.appendChild(el);
      });
    } else if (tabId === TabId.SLIDERS) {
      this.state.colorOperations.forEach((operation) => {
        let el = this._createOperationControl(operation);
        // @ts-ignore
        fr.appendChild(el);
      });
    }

    fr.childNodes.forEach((el, idx) => {
      if (idx === fr.childNodes.length - 1) {
        applyElementStyles(/** @type {HTMLElement} */ (el), STYLES['controls-list_last-item']);
      }
    });

    listEl.innerHTML = '';
    listEl.appendChild(fr);
  }

  /** @param {string} id */
  _activateTab(id, { fromViewer }) {
    this.state.tabId = id;

    if (id === TabId.CROP) {
      this.state.faderEl.deactivate();
      this._cropperEl.activate(this.read('*imageSize'), { fromViewer });
    } else {
      this.state.faderEl.activate({ url: this.state.originalUrl, fromViewer });
      this._cropperEl.deactivate({ seamlessTransition: true });
    }

    for (let tabId of TABS) {
      let isCurrentTab = tabId === id;

      let tabToggleEl = this[`tab-toggle-${tabId}`];
      tabToggleEl.active = isCurrentTab;

      if (isCurrentTab) {
        this._renderControlsList(id);
        this._syncTabIndicator();
      } else {
        this._unmountTabControls(tabId);
      }

      this.state[`presence.tabContent${tabId}`] = isCurrentTab;
    }
  }

  /** @param {string} tabId */
  _unmountTabControls(tabId) {
    let listEl = this[`controls-list-${tabId}`];
    if (listEl) {
      listEl.innerHTML = '';
    }
  }

  _syncTabIndicator() {
    let tabToggleEl = this[`tab-toggle-${this.state.tabId}`];
    let indicatorEl = this['tabs-indicator'];
    indicatorEl.style.transform = `translateX(${tabToggleEl.offsetLeft}px)`;
  }

  _preloadEditedImage() {
    if (this._imgContainerEl && this.state.originalUrl) {
      let width = this._imgContainerEl.offsetWidth;
      let src = viewerImageSrc(this.state.originalUrl, width, this.state.editorTransformations);
      this._cancelPreload && this._cancelPreload();
      let { cancel } = batchPreloadImages([src]);
      this._cancelPreload = () => {
        cancel();
        this._cancelPreload = undefined;
      };
    }
  }

  _showLoader(show) {
    this.state.showLoader = show;
  }

  readyCallback() {
    super.readyCallback();

    this.sub('*imageSize', (imageSize) => {
      if (imageSize) {
        setTimeout(() => {
          this._activateTab(this.state.tabId, { fromViewer: true });
        }, 0);
      }
    });

    // this.sub('*widthBreakpoint', (bp) => {
    //   let isMobile = bp < BREAKPOINTS.max;
    //   applyElementStyles(this, STYLES[isMobile ? ':host--mobile' : ':host--desktop']);
    //   this._syncTabIndicator();
    // });

    this.sub('currentFilter', (currentFilter) => {
      this.state.operationTooltip = currentFilter || FAKE_ORIGINAL_FILTER;
      this.state['css.operationTooltip'] = currentFilter
        ? COND.operation_tooltip_visible
        : COND.operation_tooltip_hidden;
    });

    this.sub('currentOperation', (currentOperation) => {
      if (this.state.tabId !== TabId.SLIDERS) {
        return;
      }
      this.state.operationTooltip = currentOperation;
      this.state['css.operationTooltip'] = currentOperation
        ? COND.operation_tooltip_visible
        : COND.operation_tooltip_hidden;
    });

    this.sub('tabId', (tabId) => {
      if (tabId === TabId.FILTERS) {
        this.state.operationTooltip = this.state.currentFilter;
        this.state['css.operationTooltip'] = COND.operation_tooltip_visible;
        return;
      }
      this.state['css.operationTooltip'] = COND.operation_tooltip_hidden;
    });

    this.sub('*originalUrl', (originalUrl) => {
      this.state.originalUrl = originalUrl;
      this.state.faderEl && this.state.faderEl.deactivate();
    });

    this.sub('editorTransformations', (transformations) => {
      this._preloadEditedImage();
      if (this.state.faderEl) {
        this.state.faderEl.setTransformations(transformations);
      }
    });

    this.sub('*transformations', (transformations) => {
      if (transformations) {
        this.state.editorTransformations = transformations;
      }
    });

    this.sub('loadingOperations', (loadingOperations) => {
      let loading = Object.values(loadingOperations).some((obj) => Object.values(obj).some(Boolean));
      this._debouncedShowLoader(loading);
    });

    this.sub('showSlider', (showSlider) => {
      this.state['presence.subToolbar'] = showSlider;
      this.state['presence.mainToolbar'] = !showSlider;
    });

    this.sub('networkProblems', (networkProblems) => {
      if (this.read('*networkProblems') !== networkProblems) {
        this.pub('*networkProblems', networkProblems);
      }
    });

    this.sub('*networkProblems', (networkProblems) => {
      if (this.state.networkProblems !== networkProblems) {
        this.state.networkProblems = networkProblems;
      }
    });
  }
}

EditorToolbar.renderShadow = false;
EditorToolbar.styles = STYLES;

EditorToolbar.template = /*html*/ `
<${LineLoaderUi.is} set="active: showLoader"></${LineLoaderUi.is}>
<div css="filter-tooltip_container">
  <div css="filter-tooltip_wrapper">
    <div css set="css: css.operationTooltip; textContent: operationTooltip"></div>
  </div>
</div>
<div css="toolbar-container">
  <${PresenceToggle.is} css="sub-toolbar" set="visible: presence.mainToolbar; styles: presence.subTopToolbarStyles">
      <div css="tab-content-row">
      ${TABS.map(renderTabContent).join('')}
      </div>
      <div css="controls-row">
        <${UcBtnUi.is} theme="boring" icon="closeMax" set="ariaClick: on.cancel">
        </${UcBtnUi.is}>
        <div css="tab-toggles">
          <div ref="tabs-indicator" css="tab-toggles_indicator"></div>
          ${TABS.map(renderTabToggle).join('')}
        </div>
        <${UcBtnUi.is} theme="primary" icon="done" set="ariaClick: on.apply">
        </${UcBtnUi.is}>
      </div>
  </${PresenceToggle.is}>
  <${PresenceToggle.is} css="sub-toolbar" set="visible: presence.subToolbar; styles: presence.subBottomToolbarStyles">
      <div css="slider">
        <${EditorSlider.is} set="faderEl: faderEl; dataCtxProvider: ctxProvider" ref="slider-el"></${EditorSlider.is}>
      </div>
      <div css="controls-row">
        <${UcBtnUi.is} theme="boring" set="ariaClick: on.cancelSlider; text: [l10n]Cancel">
        </${UcBtnUi.is}>
        <${UcBtnUi.is} theme="primary" set="ariaClick: on.applySlider; text: [l10n]Apply">
        </${UcBtnUi.is}>
      </div>
  </${PresenceToggle.is}>
</div>
`;
