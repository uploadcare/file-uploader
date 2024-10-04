// @ts-check

import { create } from '@symbiotejs/symbiote';
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { stringToArray } from '../../utils/stringToArray.js';
import { wildcardRegexp } from '../../utils/wildcardRegexp.js';
import { buildStyles } from './buildStyles.js';
import { registerMessage, unregisterMessage } from './messages.js';
import { queryString } from './query-string.js';

/** @typedef {{ externalSourceType: string }} ActivityParams */

/**
 * @typedef {{
 *   type: 'file-selected';
 *   obj_type: 'selected_file';
 *   filename: string;
 *   url: string;
 *   alternatives?: Record<string, string>;
 * }} SelectedFileMessage
 */

/**
 * @typedef {{
 *   type: 'embed-css';
 *   style: string;
 * }} EmbedCssMessage
 */

/** @typedef {SelectedFileMessage | EmbedCssMessage} Message */

export class ExternalSource extends UploaderBlock {
  couldBeCtxOwner = true;
  activityType = ActivityBlock.activities.EXTERNAL;

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      activityIcon: '',
      activityCaption: '',
      selectedList: [],
      counter: 0,
      multiple: false,
      onDone: () => {
        for (const message of this.$.selectedList) {
          const url = this.extractUrlFromMessage(message);
          const { filename } = message;
          const { externalSourceType } = this.activityParams;
          this.api.addFileFromUrl(url, { fileName: filename, source: externalSourceType });
        }

        this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
      },
      onCancel: () => {
        this.historyBack();
      },
    };
  }

  /** @type {ActivityParams} */
  get activityParams() {
    const params = super.activityParams;
    if ('externalSourceType' in params) {
      return params;
    }
    throw new Error(`External Source activity params not found`);
  }

  /**
   * @private
   * @type {HTMLIFrameElement | null}
   */
  _iframe = null;

  initCallback() {
    super.initCallback();
    this.registerActivity(this.activityType, {
      onActivate: () => {
        let { externalSourceType } = /** @type {ActivityParams} */ (this.activityParams);

        if (!externalSourceType) {
          this.$['*currentActivity'] = null;
          this.setOrAddState('*modalActive', false);
          console.error(`Param "externalSourceType" is required for activity "${this.activityType}"`);
          return;
        }

        this.set$({
          activityCaption: `${externalSourceType?.[0].toUpperCase()}${externalSourceType?.slice(1)}`,
          activityIcon: externalSourceType,
        });

        this.mountIframe();
      },
    });
    this.sub('*currentActivityParams', (val) => {
      if (!this.isActivityActive) {
        return;
      }
      this.unmountIframe();
      this.mountIframe();
    });
    this.sub('*currentActivity', (val) => {
      if (val !== this.activityType) {
        this.unmountIframe();
      }
    });
    this.sub('selectedList', (list) => {
      this.$.counter = list.length;
    });
    this.subConfigValue('multiple', (multiple) => {
      this.$.multiple = multiple;
    });
  }

  /**
   * @private
   * @param {SelectedFileMessage} message
   */
  extractUrlFromMessage(message) {
    if (message.alternatives) {
      const preferredTypes = stringToArray(this.cfg.externalSourcesPreferredTypes);
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
  }

  /**
   * @private
   * @param {Message} message
   */
  sendMessage(message) {
    this._iframe?.contentWindow?.postMessage(JSON.stringify(message), '*');
  }

  /**
   * @private
   * @param {SelectedFileMessage} message
   */
  async handleFileSelected(message) {
    if (!this.$.multiple && this.$.selectedList.length) {
      return;
    }

    this.$.selectedList = [...this.$.selectedList, message];

    if (!this.$.multiple) {
      this.$.onDone();
    }
  }

  /** @private */
  handleIframeLoad() {
    this.applyStyles();
  }

  /**
   * @private
   * @param {string} propName
   */
  getCssValue(propName) {
    let style = window.getComputedStyle(this);
    return style.getPropertyValue(propName).trim();
  }

  /** @private */
  applyStyles() {
    let colors = {
      radius: this.getCssValue('--uc-radius'),
      backgroundColor: this.getCssValue('--uc-background'),
      textColor: this.getCssValue('--uc-foreground'),
      secondaryColor: this.getCssValue('--uc-secondary'),
      secondaryForegroundColor: this.getCssValue('--uc-secondary-foreground'),
      secondaryHover: this.getCssValue('--uc-secondary-hover'),
      linkColor: this.getCssValue('--uc-primary'),
      linkColorHover: this.getCssValue('--uc-primary-hover'),
      fontFamily: this.getCssValue('--uc-font-family'),
      fontSize: this.getCssValue('--uc-font-size'),
    };

    this.sendMessage({
      type: 'embed-css',
      style: buildStyles(colors),
    });
  }

  /** @private */
  remoteUrl() {
    const { pubkey, remoteTabSessionKey, socialBaseUrl } = this.cfg;
    const { externalSourceType } = this.activityParams;
    const lang = this.l10n('social-source-lang')?.split('-')?.[0] || 'en';
    const params = {
      lang,
      public_key: pubkey,
      images_only: false.toString(),
      pass_window_open: false,
      session_key: remoteTabSessionKey,
    };
    const url = new URL(`/window3/${externalSourceType}`, socialBaseUrl);
    url.search = queryString(params);
    return url.toString();
  }

  /** @private */
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
    this.$.selectedList = [];
  }

  /** @private */
  unmountIframe() {
    this._iframe && unregisterMessage('file-selected', this._iframe.contentWindow);
    this.ref.iframeWrapper.innerHTML = '';
    this._iframe = null;
    this.$.selectedList = [];
    this.$.counter = 0;
  }
}

ExternalSource.template = /* HTML */ `
  <uc-activity-header>
    <button type="button" class="uc-mini-btn" set="onclick: *historyBack" l10n="@title:back">
      <uc-icon name="back"></uc-icon>
    </button>
    <div>
      <uc-icon set="@name: activityIcon"></uc-icon>
      <span>{{activityCaption}}</span>
    </div>
    <button
      type="button"
      class="uc-mini-btn uc-close-btn"
      set="onclick: *historyBack"
      l10n="@title:a11y-activity-header-button-close"
    >
      <uc-icon name="close"></uc-icon>
    </button>
  </uc-activity-header>
  <div class="uc-content">
    <div ref="iframeWrapper" class="uc-iframe-wrapper"></div>
    <div class="uc-toolbar">
      <button type="button" class="uc-cancel-btn uc-secondary-btn" set="onclick: onCancel" l10n="cancel"></button>
      <div></div>
      <div set="@hidden: !multiple" class="uc-selected-counter"><span l10n="selected-count"></span>{{counter}}</div>
      <button
        type="button"
        class="uc-done-btn uc-primary-btn"
        set="onclick: onDone; @disabled: !counter"
        l10n="done"
      ></button>
    </div>
  </div>
`;
