import { create } from '../../node_modules/@symbiotejs/symbiote/build/symbiote.js';
import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { registerMessage, unregisterMessage } from './messages.js';
import { buildStyles } from './buildStyles.js';

export class ExternalSource extends BlockComponent {
  activityType = BlockComponent.activities.EXTERNAL;

  init$ = {
    counter: 0,
    onDone: () => {
      this.$['*currentActivity'] = BlockComponent.activities.UPLOAD_LIST;
    },
    onCancel: () => {
      this.set$({
        '*currentActivity': BlockComponent.activities.SOURCE_SELECT,
      });
    },
  };

  /** @private */
  _iframe = null;

  initCallback() {
    this.registerActivity(this.activityType, () => {
      let { externalSourceType } = this.activityParams;

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
    let version = '3.11.3';
    let imagesOnly = false.toString();
    let { externalSourceType } = this.activityParams;
    return `https://social.uploadcare.com/window3/${externalSourceType}?lang=en&public_key=${pubkey}&widget_version=${version}&images_only=${imagesOnly}&pass_window_open=false`;
  }

  mountIframe() {
    console.log('IFRAME');
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
