import { create } from '@symbiotejs/symbiote';
import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { registerMessage, unregisterMessage } from './messages.js';
import { buildStyles } from './buildStyles.js';
import { queryString } from './query-string.js';
import { wildcardRegexp } from '../../utils/wildcardRegexp.js';
import { stringToArray } from '../../utils/stringToArray.js';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../env.js';
/**
 * @typedef {Object} ActivityParams
 * @property {String} externalSourceType
 */

export class ExternalSource extends UploaderBlock {
  activityType = ActivityBlock.activities.EXTERNAL;

  init$ = {
    ...this.init$,
    activityIcon: '',
    activityCaption: '',
    counter: 0,
    onDone: () => {
      this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
    },
    onCancel: () => {
      this.historyBack();
    },
  };

  /** @private */
  _iframe = null;

  initCallback() {
    super.initCallback();
    this.registerActivity(this.activityType, {
      onActivate: () => {
        let { externalSourceType } = /** @type {ActivityParams} */ (this.activityParams);

        this.set$({
          activityCaption: `${externalSourceType?.[0].toUpperCase()}${externalSourceType?.slice(1)}`,
          activityIcon: externalSourceType,
        });

        this.$.counter = 0;
        this.mountIframe();
      },
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

    const url = (() => {
      if (message.alternatives) {
        const preferredTypes = stringToArray(this.getCssData('--cfg-external-sources-preferred-types'));
        for (const preferredType of preferredTypes) {
          const regexp = wildcardRegexp(preferredType);
          for (const [type, typeUrl] of Object.entries(message.alternatives)) {
            if (regexp.test(type)) {
              return typeUrl;
            }
          }
        }
      }
      return message.url;
    })();

    let { filename } = message;
    let { externalSourceType } = this.activityParams;
    this.addFileFromUrl(url, { fileName: filename, source: `${UploadSource.EXTERNAL}-${externalSourceType}` });
  }

  handleIframeLoad() {
    this.applyStyles();
  }

  _inheritedUpdateCssData = this.updateCssData;
  updateCssData = () => {
    if (this.isActivityActive) {
      this._inheritedUpdateCssData();
      this.applyStyles();
    }
  };

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
    let pubkey = this.getCssData('--cfg-pubkey');
    let imagesOnly = false.toString();
    let { externalSourceType } = this.activityParams;
    let params = {
      lang: this.getCssData('--l10n-locale-name')?.split('-')?.[0] || 'en',
      widget_version: `${PACKAGE_NAME}@${PACKAGE_VERSION}`,
      public_key: pubkey,
      images_only: imagesOnly,
      pass_window_open: false,
      session_key: this.getCssData('--cfg-remote-tab-session-key'),
    };
    let url = new URL(this.getCssData('--cfg-social-base-url'));
    url.pathname = `/window3/${externalSourceType}`;
    url.search = queryString(params);
    return url.toString();
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

ExternalSource.template = /* HTML */ `
  <lr-activity-header>
    <button type="button" class="mini-btn" set="onclick: *historyBack">
      <lr-icon name="back"></lr-icon>
    </button>
    <div>
      <lr-icon set="@name: activityIcon"></lr-icon>
      <span>{{activityCaption}}</span>
    </div>
    <button type="button" class="mini-btn close-btn" set="onclick: *historyBack">
      <lr-icon name="close"></lr-icon>
    </button>
  </lr-activity-header>
  <div class="content">
    <div ref="iframeWrapper" class="iframe-wrapper"></div>
    <div class="toolbar">
      <button type="button" class="cancel-btn secondary-btn" set="onclick: onCancel" l10n="cancel"></button>
      <div></div>
      <div class="selected-counter"><span l10n="selected-count"></span>{{counter}}</div>
      <button type="button" class="done-btn primary-btn" set="onclick: onDone; @disabled: !counter">
        <lr-icon name="check"></lr-icon>
      </button>
    </div>
  </div>
`;
