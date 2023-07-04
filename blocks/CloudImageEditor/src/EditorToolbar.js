import { CloudEditorBase } from './CloudEditorBase.js';
import { EditorCropButtonControl } from './EditorCropButtonControl.js';
import { EditorFilterControl } from './EditorFilterControl.js';
import { EditorOperationControl } from './EditorOperationControl.js';
import { FAKE_ORIGINAL_FILTER } from './EditorSlider.js';
import { debounce } from './lib/debounce.js';
import { batchPreloadImages } from './lib/preloadImage.js';
import {
  ALL_COLOR_OPERATIONS,
  ALL_CROP_OPERATIONS,
  ALL_FILTERS,
  COLOR_OPERATIONS_CONFIG,
  TabId,
  TABS,
} from './toolbar-constants.js';
import { viewerImageSrc } from './util.js';

/** @param {String} id */
function renderTabToggle(id) {
  return /* HTML */ `
    <lr-btn-ui
      theme="boring"
      ref="tab-toggle-${id}"
      data-id="${id}"
      icon="${id}"
      tabindex="0"
      set="onclick: on.clickTab;"
    >
    </lr-btn-ui>
  `;
}

/** @param {String} id */
function renderTabContent(id) {
  return /* HTML */ `
    <lr-presence-toggle class="tab-content" set="visible: presence.tabContent.${id}; styles: presence.tabContentStyles">
      <lr-editor-scroller hidden-scrollbar>
        <div class="controls-list_align">
          <div class="controls-list_inner" ref="controls-list-${id}"></div>
        </div>
      </lr-editor-scroller>
    </lr-presence-toggle>
  `;
}

export class EditorToolbar extends CloudEditorBase {
  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      '*sliderEl': null,
      /** @type {import('./types.js').LoadingOperations} */
      '*loadingOperations': new Map(),
      '*showSlider': false,
      '*currentFilter': FAKE_ORIGINAL_FILTER,
      '*currentOperation': null,
      '*tabId': TabId.CROP,
      showLoader: false,
      filters: ALL_FILTERS,
      colorOperations: ALL_COLOR_OPERATIONS,
      cropOperations: ALL_CROP_OPERATIONS,
      '*operationTooltip': null,

      'l10n.cancel': this.l10n('cancel'),
      'l10n.apply': this.l10n('apply'),

      'presence.mainToolbar': true,
      'presence.subToolbar': false,
      'presence.tabContent.crop': false,
      'presence.tabContent.sliders': false,
      'presence.tabContent.filters': false,
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

    /** @private */

    this._debouncedShowLoader = debounce(this._showLoader.bind(this), 500);
  }

  /** @private */
  _onSliderClose() {
    this.$['*showSlider'] = false;
    if (this.$['*tabId'] === TabId.SLIDERS) {
      this.ref['tooltip-el'].classList.toggle('info-tooltip_visible', false);
    }
  }

  /**
   * @private
   * @param {String} operation
   */
  _createOperationControl(operation) {
    let el = EditorOperationControl.is && new EditorOperationControl();
    el['operation'] = operation;
    return el;
  }

  /**
   * @private
   * @param {String} filter
   */
  _createFilterControl(filter) {
    let el = EditorFilterControl.is && new EditorFilterControl();
    el['filter'] = filter;
    return el;
  }

  /**
   * @private
   * @param {String} operation
   */
  _createToggleControl(operation) {
    let el = EditorCropButtonControl.is && new EditorCropButtonControl();
    el['operation'] = operation;
    return el;
  }

  /**
   * @private
   * @param {String} tabId
   */
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

  /**
   * @private
   * @param {String} id
   * @param {{ fromViewer?: Boolean }} options
   */
  _activateTab(id, { fromViewer }) {
    this.$['*tabId'] = id;

    if (id === TabId.CROP) {
      this.$['*faderEl'].deactivate();
      this.$['*cropperEl'].activate(this.$['*imageSize'], { fromViewer });
    } else {
      this.$['*faderEl'].activate({ url: this.$['*originalUrl'], fromViewer });
      this.$['*cropperEl'].deactivate();
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
      this.$[`presence.tabContent.${tabId}`] = isCurrentTab;
    }
  }

  /**
   * @private
   * @param {String} tabId
   */
  _unmountTabControls(tabId) {
    let listEl = this.ref[`controls-list-${tabId}`];
    if (listEl) {
      listEl.innerHTML = '';
    }
  }

  /** @private */
  _syncTabIndicator() {
    let tabToggleEl = this.ref[`tab-toggle-${this.$['*tabId']}`];
    let indicatorEl = this.ref['tabs-indicator'];
    indicatorEl.style.transform = `translateX(${tabToggleEl.offsetLeft}px)`;
  }

  /** @private */
  _preloadEditedImage() {
    if (this.$['*imgContainerEl'] && this.$['*originalUrl']) {
      let width = this.$['*imgContainerEl'].offsetWidth;
      let src = this.proxyUrl(viewerImageSrc(this.$['*originalUrl'], width, this.$['*editorTransformations']));
      this._cancelPreload && this._cancelPreload();
      let { cancel } = batchPreloadImages([src]);
      this._cancelPreload = () => {
        cancel();
        this._cancelPreload = undefined;
      };
    }
  }

  /** @private */
  _showLoader(show) {
    this.$.showLoader = show;
  }

  _updateInfoTooltip = debounce(() => {
    let transformations = this.$['*editorTransformations'];
    let text = '';
    let visible = false;

    if (this.$['*tabId'] === TabId.FILTERS) {
      visible = true;
      if (this.$['*currentFilter'] && transformations?.filter?.name === this.$['*currentFilter']) {
        let value = transformations?.filter?.amount || 100;
        text = this.l10n(this.$['*currentFilter']) + ' ' + value;
      } else {
        text = this.l10n(FAKE_ORIGINAL_FILTER);
      }
    } else if (this.$['*tabId'] === TabId.SLIDERS && this.$['*currentOperation']) {
      visible = true;
      let value =
        transformations?.[this.$['*currentOperation']] || COLOR_OPERATIONS_CONFIG[this.$['*currentOperation']].zero;
      text = this.$['*currentOperation'] + ' ' + value;
    }
    if (visible) {
      this.$['*operationTooltip'] = text;
    }
    this.ref['tooltip-el'].classList.toggle('info-tooltip_visible', visible);
  }, 0);

  initCallback() {
    super.initCallback();

    this.$['*sliderEl'] = this.ref['slider-el'];

    this.sub('*imageSize', (imageSize) => {
      if (imageSize) {
        setTimeout(() => {
          this._activateTab(this.$['*tabId'], { fromViewer: true });
        }, 0);
      }
    });

    this.sub('*editorTransformations', (editorTransformations) => {
      let appliedFilter = editorTransformations?.filter?.name;
      if (this.$['*currentFilter'] !== appliedFilter) {
        this.$['*currentFilter'] = appliedFilter;
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

    this.sub('*originalUrl', (originalUrl) => {
      this.$['*faderEl'] && this.$['*faderEl'].deactivate();
    });

    this.sub('*editorTransformations', (transformations) => {
      this._preloadEditedImage();
      if (this.$['*faderEl']) {
        this.$['*faderEl'].setTransformations(transformations);
      }
    });

    this.sub('*loadingOperations', (/** @type {import('./types.js').LoadingOperations} */ loadingOperations) => {
      let anyLoading = false;
      for (let [, mapping] of loadingOperations.entries()) {
        if (anyLoading) {
          break;
        }
        for (let [, loading] of mapping.entries()) {
          if (loading) {
            anyLoading = true;
            break;
          }
        }
      }
      this._debouncedShowLoader(anyLoading);
    });

    this.sub('*showSlider', (showSlider) => {
      this.$['presence.subToolbar'] = showSlider;
      this.$['presence.mainToolbar'] = !showSlider;
    });

    this._updateInfoTooltip();
  }
}

EditorToolbar.template = /* HTML */ `
  <lr-line-loader-ui set="active: showLoader"></lr-line-loader-ui>
  <div class="info-tooltip_container">
    <div class="info-tooltip_wrapper">
      <div ref="tooltip-el" class="info-tooltip info-tooltip_hidden">{{*operationTooltip}}</div>
    </div>
  </div>
  <div class="toolbar-container">
    <lr-presence-toggle class="sub-toolbar" set="visible: presence.mainToolbar; styles: presence.subTopToolbarStyles">
      <div class="tab-content-row">${TABS.map(renderTabContent).join('')}</div>
      <div class="controls-row">
        <lr-btn-ui theme="boring" icon="closeMax" set="onclick: on.cancel"> </lr-btn-ui>
        <div class="tab-toggles">
          <div ref="tabs-indicator" class="tab-toggles_indicator"></div>
          ${TABS.map(renderTabToggle).join('')}
        </div>
        <lr-btn-ui theme="primary" icon="done" set="onclick: on.apply"> </lr-btn-ui>
      </div>
    </lr-presence-toggle>
    <lr-presence-toggle class="sub-toolbar" set="visible: presence.subToolbar; styles: presence.subBottomToolbarStyles">
      <div class="slider">
        <lr-editor-slider ref="slider-el"></lr-editor-slider>
      </div>
      <div class="controls-row">
        <lr-btn-ui theme="boring" set="@text: l10n.cancel; onclick: on.cancelSlider;"> </lr-btn-ui>
        <lr-btn-ui theme="primary" set="@text: l10n.apply; onclick: on.applySlider;"> </lr-btn-ui>
      </div>
    </lr-presence-toggle>
  </div>
`;
