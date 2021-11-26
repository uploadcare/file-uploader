import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { registerMessage, unregisterMessage } from './messages.js';
import { uploadFile } from '../../ext_modules/upload-client.js';
import { ActivityComponent } from '../ActivityComponent/ActivityComponent.js';

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

export class ExternalSource extends ActivityComponent {
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

  onActivate() {
    super.onActivate();

    let { externalSourceType } = this.activityParams;

    this.set$({
      '*modalCaption': `${externalSourceType[0].toUpperCase()}${externalSourceType.slice(1)}`,
      '*modalIcon': externalSourceType,
    });

    this.$.counter = 0;
    this.mountIframe();
  }

  onDeactivate() {
    super.onDeactivate();
    this.unmountIframe();
  }

  sendMessage(message) {
    this._iframe.contentWindow.postMessage(JSON.stringify(message), '*');
  }

  async handleFileSelected(message) {
    this.$.counter = this.$.counter + 1;

    // TODO: check for alternatives, see https://github.com/uploadcare/uploadcare-widget/blob/f5d3e8c9f67781bed2eb69814c8f86a4cc035473/src/widget/tabs/remote-tab.js#L102
    let { url } = message;
    let pubkey = this.config.PUBKEY;
    let entry = this.uploadCollection.add({
      externalUrl: url,
    });
    // @ts-ignore
    let fileInfo = await uploadFile(url, {
      publicKey: pubkey,
      onProgress: (progress) => {
        let percentage = progress.value * 100;
        entry.setValue('uploadProgress', percentage);
      },
    });
    console.log(fileInfo);
    entry.setMultipleValues({
      uuid: fileInfo.uuid,
      fileName: fileInfo.name,
      fileSize: fileInfo.size,
      isImage: fileInfo.isImage,
      mimeType: fileInfo.mimeType,
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
    let styleObj = {
      body: {
        color: this.getCssValue('--clr-txt'),
      },
      '.side-bar': {
        'background-color': this.getCssValue('--clr-background-light'),
      },
      '.list-table-row': {
        color: this.getCssValue('--clr-txt'),
      },
      '.list-table-row:hover': {
        background: this.getCssValue('--clr-shade-lv1'),
      },
    };

    this.sendMessage({
      type: 'embed-css',
      style: styleToCss(styleObj),
    });
  }

  remoteUrl() {
    let pubkey = this.config.PUBKEY;
    let version = '3.11.3';
    let imagesOnly = false.toString();
    let { externalSourceType } = this.activityParams;
    return `https://social.uploadcare.com/window3/${externalSourceType}?lang=en&public_key=${pubkey}&widget_version=${version}&images_only=${imagesOnly}&pass_window_open=false`;
  }

  mountIframe() {
    let iframe = document.createElement('iframe');
    iframe.addEventListener('load', this.handleIframeLoad.bind(this));

    iframe.setAttribute('src', this.remoteUrl());
    iframe.setAttribute('marginheight', '0');
    iframe.setAttribute('marginwidth', '0');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowTransparency', 'true');

    let wrapper = this.ref['iframe-wrapper'];
    wrapper.innerHTML = '';
    wrapper.appendChild(iframe);

    registerMessage('file-selected', iframe.contentWindow, this.handleFileSelected.bind(this));

    this._iframe = iframe;
  }

  unmountIframe() {
    unregisterMessage('file-selected', this._iframe.contentWindow);

    let wrapper = this.ref['iframe-wrapper'];
    wrapper.innerHTML = '';
    this._iframe = undefined;
  }
}

ExternalSource.template = /*html*/ `
<div ref="iframe-wrapper" .iframe-wrapper>
</div>
<div .toolbar>
  <button
    .cancel-btn
    .secondary-btn
    set="onclick: onCancel"
    l10n="cancel">
  </button>
  <div></div>
  <div .selected-counter>
    <span l10n="selected-count"></span>
    <span set="textContent: counter"></span>
  </div>
  <button .done-btn .primary-btn set="onclick: onDone">
    <uc-icon name="check"></uc-icon>
  </button>
</div>
`;
