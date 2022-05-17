import { create } from '../../submodules/symbiote/core/symbiote.js';
import { Block } from '../../abstract/Block.js';
import { registerMessage, unregisterMessage } from './messages.js';
import { buildStyles } from './buildStyles.js';
import { queryString } from './query-string.js';

/**
 * @typedef {Object} ActivityParams
 * @property {String} externalSourceType
 */

/**
 * @typedef {Object} State
 * @property {Number} counter
 * @property {() => void} onDone
 * @property {() => void} onCancel
 */

/**
 * @typedef {State &
 *   Partial<import('../ActivityCaption/ActivityCaption').State> &
 *   Partial<import('../ActivityIcon/ActivityIcon').State>} ExternalSourceState
 */

/** @extends {Block<ExternalSourceState>} */
export class ExternalSource extends Block {
  activityType = Block.activities.EXTERNAL;

  /** @type {State} */
  init$ = {
    counter: 0,
    onDone: () => {
      this.$['*currentActivity'] = Block.activities.UPLOAD_LIST;
    },
    onCancel: () => {
      this.cancelFlow();
    },
  };

  /** @private */
  _iframe = null;

  initCallback() {
    this.bindCssData('--cfg-remote-tab-session-key');

    this.registerActivity(this.activityType, () => {
      let { externalSourceType } = /** @type {ActivityParams} */ (this.activityParams);

      this.set$({
        '*activityCaption': `${externalSourceType[0].toUpperCase()}${externalSourceType.slice(1)}`,
        '*activityIcon': externalSourceType,
      });

      this.$.counter = 0;
      this.mountIframe();
    });
    this.sub('*currentActivity', (val) => {
      if (val !== this.activityType) {
        this.unmountIframe();
      }
    });
  }

  sendMessage(message) {
    this._iframe.contentWindow.postMessage(JSON.stringify(message), '*');
  }

  async handleFileSelected(message) {
    this.$.counter = this.$.counter + 1;

    // TODO: check for alternatives, see https://github.com/uploadcare/uploadcare-widget/blob/f5d3e8c9f67781bed2eb69814c8f86a4cc035473/src/widget/tabs/remote-tab.js#L102
    let { url, filename } = message;
    this.uploadCollection.add({
      externalUrl: url,
      fileName: filename,
    });
  }

  handleIframeLoad(e) {
    this.applyStyles();
  }

  getCssValue(propName) {
    let style = window.getComputedStyle(this);
    return style.getPropertyValue(propName).trim();
  }

  applyStyles() {
    let colors = {
      backgroundColor: this.getCssValue('--clr-background-light'),
      textColor: this.getCssValue('--clr-txt'),
      shadeColor: this.getCssValue('--clr-shade-lv1'),
      linkColor: '#157cfc',
      linkColorHover: '#3891ff',
    };

    this.sendMessage({
      type: 'embed-css',
      style: buildStyles(colors),
    });
  }

  remoteUrl() {
    let pubkey = this.$['*--cfg-pubkey'];
    let imagesOnly = false.toString();
    let { externalSourceType } = this.activityParams;
    let params = {
      lang: 'en', // TOOD: pass correct lang
      // TODO: we should add a new property to the social sources application
      // to collect uc-blocks data separately from legacy widget
      widget_version: '3.11.3',
      public_key: pubkey,
      images_only: imagesOnly,
      pass_window_open: false,
      session_key: this.$['*--cfg-remote-tab-session-key'],
    };
    return `https://social.uploadcare.com/window3/${externalSourceType}?${queryString(params)}`;
  }

  mountIframe() {
    /** @type {HTMLIFrameElement} */
    // @ts-ignore
    let iframe = create({
      tag: 'iframe',
      attributes: {
        src: this.remoteUrl(),
        marginheight: 0,
        marginwidth: 0,
        frameborder: 0,
        allowTransparency: true,
      },
    });
    iframe.addEventListener('load', this.handleIframeLoad.bind(this));

    this.ref.iframeWrapper.innerHTML = '';
    this.ref.iframeWrapper.appendChild(iframe);

    registerMessage('file-selected', iframe.contentWindow, this.handleFileSelected.bind(this));

    this._iframe = iframe;
  }

  unmountIframe() {
    this._iframe && unregisterMessage('file-selected', this._iframe.contentWindow);
    this.ref.iframeWrapper.innerHTML = '';
    this._iframe = undefined;
  }
}

ExternalSource.template = /*html*/ `
<div
  ref="iframeWrapper"
  class="iframe-wrapper">
</div>
<div class="toolbar">
  <button
    class="cancel-btn secondary-btn"
    set="onclick: onCancel"
    l10n="cancel">
  </button>
  <div></div>
  <div class="selected-counter">
    <span l10n="selected-count"></span>{{counter}}</div>
  <button class="done-btn primary-btn" set="onclick: onDone">
    <uc-icon name="check"></uc-icon>
  </button>
</div>
`;
