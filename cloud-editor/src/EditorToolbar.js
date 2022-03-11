import { BlockComponent } from '@uploadcare/upload-blocks';
import { EditorCropButtonControl } from './EditorCropButtonControl.js';
import { EditorFilterControl } from './EditorFilterControl.js';
import { EditorOperationControl } from './EditorOperationControl.js';
import { FAKE_ORIGINAL_FILTER } from './EditorSlider.js';
import { classNames } from './lib/classNames.js';
import { debounce } from './lib/debounce.js';
import { batchPreloadImages } from './lib/preloadImage.js';
import { ALL_COLOR_OPERATIONS, ALL_CROP_OPERATIONS, ALL_FILTERS, TabId, TABS } from './toolbar-constants.js';
import { viewerImageSrc } from './viewer_util.js';

function renderTabToggle(id) {
  return /*html*/ `
    <uc-btn-ui theme="boring" ref="tab-toggle-${id}" data-id="${id}" icon="${id}" tabindex="0" set="onclick: on.clickTab;">
    </uc-btn-ui>
  `;
}

function renderTabContent(id) {
  return /*html*/ `
    <uc-presence-toggle class="tab-content" set="visible: presence.tabContent${id}; styles: presence.tabContentStyles">
        <uc-editor-scroller hidden-scrollbar>
          <div class="controls-list_align">
            <div class="controls-list_inner" ref="controls-list-${id}">
            </div>
          </div>
        </uc-editor-scroller>
    </uc-presence-toggle>
  `;
}

export class EditorToolbar extends BlockComponent {
  constructor() {
    super();

    this.init$ = {
      '*sliderEl': null,
      '*loadingOperations': {},
      '*showSlider': false,
      /** @type {import('../../../src/types/UploadEntry.js').Transformations} */
      '*editorTransformations': {},
      '*currentFilter': FAKE_ORIGINAL_FILTER,
      '*currentOperation': null,
      showLoader: false,
      tabId: TabId.CROP,
      filters: ALL_FILTERS,
      colorOperations: ALL_COLOR_OPERATIONS,
      cropOperations: ALL_CROP_OPERATIONS,
      '*operationTooltip': null,

      'l10n.cancel': this.l10n('cancel'),
      'l10n.apply': this.l10n('apply'),

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
        this.$['*on.cancel']();
      },
      'on.apply': (e) => {
        this.$['*on.apply'](this.$['*editorTransformations']);
      },
      'on.applySlider': (e) => {
        this.ref['slider-el'].apply();
        this._onSliderClose();
      },
      'on.cancelSlider': (e) => {
        this.ref['slider-el'].cancel();
        this._onSliderClose();
      },
      'on.clickTab': (e) => {
        let id = e.currentTarget.getAttribute('data-id');
        this._activateTab(id, { fromViewer: false });
      },
    };

    this._debouncedShowLoader = debounce(this._showLoader.bind(this), 500);
  }

  get tabId() {
    return this.$.tabId;
  }

  _onSliderClose() {
    this.$['*showSlider'] = false;
    if (this.$.tabId === TabId.SLIDERS) {
      this.ref['tooltip-el'].className = classNames('filter-tooltip', {
        'filter-tooltip_visible': false,
        'filter-tooltip_hidden': true,
      });
    }
  }

  /** @param {string} operation */
  _createOperationControl(operation) {
    let el = EditorOperationControl.is && new EditorOperationControl();
    el['operation'] = operation;
    return el;
  }

  /** @param {string} filter */
  _createFilterControl(filter) {
    let el = EditorFilterControl.is && new EditorFilterControl();
    el['filter'] = filter;
    return el;
  }

  _createToggleControl(operation) {
    let el = EditorCropButtonControl.is && new EditorCropButtonControl();
    el['operation'] = operation;
    return el;
  }

  /** @param {string} tabId */
  _renderControlsList(tabId) {
    let listEl = this.ref[`controls-list-${tabId}`];
    let fr = document.createDocumentFragment();

    if (tabId === TabId.CROP) {
      this.$.cropOperations.forEach((operation) => {
        let el = this._createToggleControl(operation);
        // @ts-ignore
        fr.appendChild(el);
      });
    } else if (tabId === TabId.FILTERS) {
      [FAKE_ORIGINAL_FILTER, ...this.$.filters].forEach((filterId) => {
        let el = this._createFilterControl(filterId);
        // @ts-ignore
        fr.appendChild(el);
      });
    } else if (tabId === TabId.SLIDERS) {
      this.$.colorOperations.forEach((operation) => {
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
    this.$.tabId = id;

    if (id === TabId.CROP) {
      this.$['*faderEl'].deactivate();
      this.$['*cropperEl'].activate(this.$['*imageSize'], { fromViewer });
    } else {
      this.$['*faderEl'].activate({ url: this.$['*originalUrl'], fromViewer });
      this.$['*cropperEl'].deactivate({ seamlessTransition: true });
    }

    for (let tabId of TABS) {
      let isCurrentTab = tabId === id;

      let tabToggleEl = this.ref[`tab-toggle-${tabId}`];
      tabToggleEl.active = isCurrentTab;

      if (isCurrentTab) {
        this._renderControlsList(id);
        this._syncTabIndicator();
      } else {
        this._unmountTabControls(tabId);
      }
      this.$[`presence.tabContent${tabId}`] = isCurrentTab;
    }
  }

  /** @param {string} tabId */
  _unmountTabControls(tabId) {
    let listEl = this.ref[`controls-list-${tabId}`];
    if (listEl) {
      listEl.innerHTML = '';
    }
  }

  _syncTabIndicator() {
    let tabToggleEl = this.ref[`tab-toggle-${this.$.tabId}`];
    let indicatorEl = this.ref['tabs-indicator'];
    indicatorEl.style.transform = `translateX(${tabToggleEl.offsetLeft}px)`;
  }

  _preloadEditedImage() {
    if (this.$['*imgContainerEl'] && this.$['*originalUrl']) {
      let width = this.$['*imgContainerEl'].offsetWidth;
      let src = viewerImageSrc(this.$['*originalUrl'], width, this.$['*editorTransformations']);
      this._cancelPreload && this._cancelPreload();
      let { cancel } = batchPreloadImages([src]);
      this._cancelPreload = () => {
        cancel();
        this._cancelPreload = undefined;
      };
    }
  }

  _showLoader(show) {
    this.$.showLoader = show;
  }

  initCallback() {
    super.initCallback();

    this.$['*sliderEl'] = this.ref['slider-el'];

    this.sub('*imageSize', (imageSize) => {
      if (imageSize) {
        setTimeout(() => {
          this._activateTab(this.$.tabId, { fromViewer: true });
        }, 0);
      }
    });

    // this.sub('*widthBreakpoint', (bp) => {
    //   let isMobile = bp < BREAKPOINTS.max;
    //   applyElementStyles(this, STYLES[isMobile ? ':host--mobile' : ':host--desktop']);
    //   this._syncTabIndicator();
    // });

    this.sub('*currentFilter', (currentFilter) => {
      this.$['*operationTooltip'] = this.l10n(currentFilter || FAKE_ORIGINAL_FILTER);
      this.ref['tooltip-el'].className = classNames('filter-tooltip', {
        'filter-tooltip_visible': currentFilter,
        'filter-tooltip_hidden': !currentFilter,
      });
    });

    this.sub('*currentOperation', (currentOperation) => {
      if (this.$.tabId !== TabId.SLIDERS) {
        return;
      }
      this.$['*operationTooltip'] = currentOperation;
      this.ref['tooltip-el'].className = classNames('filter-tooltip', {
        'filter-tooltip_visible': currentOperation,
        'filter-tooltip_hidden': !currentOperation,
      });
    });

    this.sub('*tabId', (tabId) => {
      if (tabId === TabId.FILTERS) {
        this.$['*operationTooltip'] = this.$['*currentFilter'];
      }
      this.ref['tooltip-el'].className = classNames('filter-tooltip', {
        'filter-tooltip_visible': tabId === TabId.FILTERS,
        'filter-tooltip_hidden': tabId !== TabId.FILTERS,
      });
    });

    this.sub('*originalUrl', (originalUrl) => {
      this.$['*faderEl'] && this.$['*faderEl'].deactivate();
    });

    this.sub('*editorTransformations', (transformations) => {
      this._preloadEditedImage();
      if (this.$['*faderEl']) {
        this.$['*faderEl'].setTransformations(transformations);
      }
    });

    this.sub('*loadingOperations', (loadingOperations) => {
      let loading = Object.values(loadingOperations || {}).some((obj) => Object.values(obj).some(Boolean));
      this._debouncedShowLoader(loading);
    });

    this.sub('*showSlider', (showSlider) => {
      this.$['presence.subToolbar'] = showSlider;
      this.$['presence.mainToolbar'] = !showSlider;
    });
  }
}

EditorToolbar.template = /*html*/ `
<uc-line-loader-ui set="active: showLoader"></uc-line-loader-ui>
<div class="filter-tooltip_container">
  <div class="filter-tooltip_wrapper">
    <div ref="tooltip-el" class="filter-tooltip filter-tooltip_visible" set="textContent: *operationTooltip"></div>
  </div>
</div>
<div class="toolbar-container">
  <uc-presence-toggle class="sub-toolbar" set="visible: presence.mainToolbar; styles: presence.subTopToolbarStyles">
      <div class="tab-content-row">
      ${TABS.map(renderTabContent).join('')}
      </div>
      <div class="controls-row">
        <uc-btn-ui theme="boring" icon="closeMax" set="onclick: on.cancel">
        </uc-btn-ui>
        <div class="tab-toggles">
          <div ref="tabs-indicator" class="tab-toggles_indicator"></div>
          ${TABS.map(renderTabToggle).join('')}
        </div>
        <uc-btn-ui theme="primary" icon="done" set="onclick: on.apply">
        </uc-btn-ui>
      </div>
  </uc-presence-toggle>
  <uc-presence-toggle class="sub-toolbar" set="visible: presence.subToolbar; styles: presence.subBottomToolbarStyles">
      <div class="slider">
        <uc-editor-slider ref="slider-el"></uc-editor-slider>
      </div>
      <div class="controls-row">
        <uc-btn-ui theme="boring" set="@text: l10n.cancel; onclick: on.cancelSlider;">
        </uc-btn-ui>
        <uc-btn-ui theme="primary" set="@text: l10n.apply; onclick: on.applySlider;">
        </uc-btn-ui>
      </div>
  </uc-presence-toggle>
</div>
`;
