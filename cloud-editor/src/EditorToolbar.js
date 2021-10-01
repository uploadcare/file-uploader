import { AppComponent } from './AppComponent.js';
import { EditorCropButtonControl } from './EditorCropButtonControl.js';
import { EditorFilterControl } from './EditorFilterControl.js';
import { EditorOperationControl } from './EditorOperationControl.js';
import { EditorScroller } from './EditorScroller.js';
import { EditorSlider, FAKE_ORIGINAL_FILTER } from './EditorSlider.js';
import { UcBtnUi } from './elements/button/UcBtnUi.js';
import { LineLoaderUi } from './elements/line-loader/LineLoaderUi.js';
import { PresenceToggle } from './elements/presence-toggle/PresenceToggle.js';
// import { BREAKPOINTS } from '../../shared-styles/design-system.js';
import { classNames } from './lib/classNames.js';
import { debounce } from './lib/debounce.js';
import { batchPreloadImages } from './lib/preloadImage.js';
import { ALL_COLOR_OPERATIONS, ALL_CROP_OPERATIONS, ALL_FILTERS, TabId, TABS } from './toolbar-constants.js';
import { viewerImageSrc } from './viewer_util.js';

function renderTabToggle(id) {
  return /*html*/ `
    <${UcBtnUi.is} theme="boring" ref="tab-toggle-${id}" data-id="${id}" icon="${id}" tabindex="0" set="ariaClick: on.clickTab;">
    </${UcBtnUi.is}>
  `;
}

function renderTabContent(id) {
  return /*html*/ `
    <${PresenceToggle.is} class="tab-content" set="visible: presence.tabContent${id}; styles: presence.tabContentStyles">
        <${EditorScroller.is} hidden-scrollbar>
          <div class="controls-list_align">
            <div class="controls-list_inner" ref="controls-list-${id}">
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

      'presence.mainToolbar': true,
      'presence.subToolbar': false,
      [`presence.tabContent${TabId.CROP}`]: false,
      [`presence.tabContent${TabId.SLIDERS}`]: false,
      [`presence.tabContent${TabId.FILTERS}`]: false,
      'presence.subTopToolbarStyles': {
        hidden: 'sub-toolbar--top-hidden',
        visible: 'sub-toolbar--visible',
      },
      'presence.subBottomToolbarStyles': {
        hidden: 'sub-toolbar--bottom-hidden',
        visible: 'sub-toolbar--visible',
      },
      'presence.tabContentStyles': {
        hidden: 'tab-content--hidden',
        visible: 'tab-content--visible',
      },
      'on.cancel': (e) => {
        this._cancelPreload && this._cancelPreload();
        this.read('*on.cancel')();
      },
      'on.apply': (e) => {
        this.read('*on.apply')(this.state.editorTransformations);
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
      this['tooltip-el'].className = classNames('filter-tooltip', {
        'filter-tooltip_visible': false,
        'filter-tooltip_hidden': true,
      });
    }
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

    fr.childNodes.forEach((/** @type {HTMLElement} */ el, idx) => {
      if (idx === fr.childNodes.length - 1) {
        el.classList.add('controls-list_last-item');
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
      this['tooltip-el'].className = classNames('filter-tooltip', {
        'filter-tooltip_visible': currentFilter,
        'filter-tooltip_hidden': !currentFilter,
      });
    });

    this.sub('currentOperation', (currentOperation) => {
      if (this.state.tabId !== TabId.SLIDERS) {
        return;
      }
      this.state.operationTooltip = currentOperation;
      this['tooltip-el'].className = classNames('filter-tooltip', {
        'filter-tooltip_visible': currentOperation,
        'filter-tooltip_hidden': !currentOperation,
      });
    });

    this.sub('tabId', (tabId) => {
      if (tabId === TabId.FILTERS) {
        this.state.operationTooltip = this.state.currentFilter;
      }
      this['tooltip-el'].className = classNames('filter-tooltip', {
        'filter-tooltip_visible': tabId === TabId.FILTERS,
        'filter-tooltip_hidden': tabId !== TabId.FILTERS,
      });
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

EditorToolbar.template = /*html*/ `
<${LineLoaderUi.is} set="active: showLoader"></${LineLoaderUi.is}>
<div class="filter-tooltip_container">
  <div class="filter-tooltip_wrapper">
    <div ref="tooltip-el" class="filter-tooltip filter-tooltip_visible" set="textContent: operationTooltip"></div>
  </div>
</div>
<div class="toolbar-container">
  <${PresenceToggle.is} class="sub-toolbar" set="visible: presence.mainToolbar; styles: presence.subTopToolbarStyles">
      <div class="tab-content-row">
      ${TABS.map(renderTabContent).join('')}
      </div>
      <div class="controls-row">
        <${UcBtnUi.is} theme="boring" icon="closeMax" set="ariaClick: on.cancel">
        </${UcBtnUi.is}>
        <div class="tab-toggles">
          <div ref="tabs-indicator" class="tab-toggles_indicator"></div>
          ${TABS.map(renderTabToggle).join('')}
        </div>
        <${UcBtnUi.is} theme="primary" icon="done" set="ariaClick: on.apply">
        </${UcBtnUi.is}>
      </div>
  </${PresenceToggle.is}>
  <${PresenceToggle.is} class="sub-toolbar" set="visible: presence.subToolbar; styles: presence.subBottomToolbarStyles">
      <div class="slider">
        <${EditorSlider.is} set="faderEl: faderEl; dataCtxProvider: ctxProvider" ref="slider-el"></${EditorSlider.is}>
      </div>
      <div class="controls-row">
        <${UcBtnUi.is} theme="boring" set="ariaClick: on.cancelSlider; text: [l10n]Cancel">
        </${UcBtnUi.is}>
        <${UcBtnUi.is} theme="primary" set="ariaClick: on.applySlider; text: [l10n]Apply">
        </${UcBtnUi.is}>
      </div>
  </${PresenceToggle.is}>
</div>
`;

EditorToolbar.is = 'editor-toolbar';
