import { create } from '../../ext_modules/symbiote.js';
import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { registerMessage, unregisterMessage } from './messages.js';

let styleToCss = (style) => {
  let css = Object.keys(style).reduce((acc, selector) => {
    let propertiesObj = style[selector];
    let propertiesStr = Object.keys(propertiesObj).reduce((acc, prop) => {
      let value = propertiesObj[prop];
      return acc + `${prop}: ${value};`;
    }, '');
    return acc + `${selector}{${propertiesStr}}`;
  }, '');
  return css;
};

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

  _iframe = null;

  initCallback() {
    this.registerActivity(this.activityType, () => {
      let { externalSourceType } = this.activityParams;

      this.set$({
        '*modalCaption': `${externalSourceType[0].toUpperCase()}${externalSourceType.slice(1)}`,
        '*modalIcon': externalSourceType,
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
    let background = this.getCssValue('--clr-background-light');
    let textColor = this.getCssValue('--clr-txt');
    let shade = this.getCssValue('--clr-shade-lv1');
    let border = `solid 1px ${shade}`;

    // TODO: get link colors from the theme
    let linkColor = '#157cfc';
    let linkColorHover = '#3891ff';

    // TODO: we need to update source source styles, add css custom properties to control theme
    let styleObj = {
      body: {
        color: textColor,
        'background-color': background,
      },
      '.side-bar': {
        background: 'inherit',
        'border-right': border,
      },
      '.main-content': {
        background: 'inherit',
      },
      '.main-content-header': {
        background: 'inherit',
      },
      '.main-content-footer': {
        background: 'inherit',
      },
      '.list-table-row': {
        color: 'inherit',
      },
      '.list-table-row:hover': {
        background: shade,
      },
      '.list-table-row .list-table-cell-a, .list-table-row .list-table-cell-b': {
        'border-top': border,
      },
      '.list-table-body .list-items': {
        'border-bottom': border,
      },
      '.bread-crumbs a': {
        color: linkColor,
      },
      '.bread-crumbs a:hover': {
        color: linkColorHover,
      },
      '.main-content.loading': {
        background: `${background} url(/static/images/loading_spinner.gif) center no-repeat`,
        'background-size': '25px 25px',
      },
      '.list-icons-item': {
        background: `center no-repeat ${shade}`,
      },
      '.source-gdrive .side-bar-menu a, .source-gphotos .side-bar-menu a': {
        color: linkColor,
      },
      '.source-gdrive .side-bar-menu a, .source-gphotos .side-bar-menu a:hover': {
        color: linkColorHover,
      },
      '.side-bar-menu a': {
        color: linkColor,
      },
      '.side-bar-menu a:hover': {
        color: linkColorHover,
      },
      '.source-gdrive .side-bar-menu .current, .source-gdrive .side-bar-menu a:hover, .source-gphotos .side-bar-menu .current, .source-gphotos .side-bar-menu a:hover':
        {
          color: linkColorHover,
        },
      '.source-vk .side-bar-menu a': {
        color: linkColor,
      },
      '.source-vk .side-bar-menu a:hover': {
        color: linkColorHover,
        background: 'none',
      },
    };

    this.sendMessage({
      type: 'embed-css',
      style: styleToCss(styleObj),
    });
  }

  remoteUrl() {
    let pubkey = this.cfg('pubkey');
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
    <span l10n="selected-count"></span>
    <span set="textContent: counter"></span>
  </div>
  <button class="done-btn primary-btn" set="onclick: onDone">
    <uc-icon name="check"></uc-icon>
  </button>
</div>
`;
