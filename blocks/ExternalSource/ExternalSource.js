// @ts-check

import { create } from '@symbiotejs/symbiote';
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { stringToArray } from '../../utils/stringToArray.js';
import { wildcardRegexp } from '../../utils/wildcardRegexp.js';
import { buildThemeDefinition } from './buildThemeDefinition.js';
import { MessageBridge } from './MessageBridge.js';
import { queryString } from './query-string.js';
import { getTopLevelOrigin } from '../../utils/get-top-level-origin.js';
import { ExternalUploadSource } from '../utils/UploadSource.js';

/** @type {Record<string, string>} */
const SOCIAL_SOURCE_MAPPING = {
  [ExternalUploadSource.GDRIVE]: 'ngdrive',
};

/** @typedef {{ externalSourceType: string }} ActivityParams */

export class ExternalSource extends UploaderBlock {
  couldBeCtxOwner = true;
  activityType = ActivityBlock.activities.EXTERNAL;

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      activityIcon: '',
      activityCaption: '',

      /** @type {import('./types.js').InputMessageMap['selected-files-change']['selectedFiles']} */
      selectedList: [],
      total: 0,

      isSelectionReady: false,
      isDoneBtnEnabled: false,
      couldSelectAll: false,
      couldDeselectAll: false,
      showSelectionStatus: false,
      counterText: '',
      doneBtnTextClass: 'uc-hidden',
      toolbarVisible: true,

      onDone: () => {
        for (const message of this.$.selectedList) {
          const url = this.extractUrlFromSelectedFile(message);
          const { filename } = message;
          const { externalSourceType } = this.activityParams;
          this.api.addFileFromUrl(url, { fileName: filename, source: externalSourceType });
        }

        this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
        this.modalManager.open(ActivityBlock.activities.UPLOAD_LIST);
      },
      onCancel: () => {
        this.historyBack();
      },

      onSelectAll: () => {
        this._messageBridge?.send({ type: 'select-all' });
      },

      onDeselectAll: () => {
        this._messageBridge?.send({ type: 'deselect-all' });
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

  initCallback() {
    super.initCallback();
    this.registerActivity(this.activityType, {
      onActivate: () => {
        let { externalSourceType } = /** @type {ActivityParams} */ (this.activityParams);

        if (!externalSourceType) {
          this.modalManager.close(this.$['*currentActivity']);
          this.$['*currentActivity'] = null;
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
    this.subConfigValue('multiple', (multiple) => {
      this.$.showSelectionStatus = multiple;
    });

    this.subConfigValue('localeName', (val) => {
      this.setupL10n();
    });

    this.subConfigValue('externalSourcesEmbedCss', (embedCss) => {
      this.applyEmbedCss(embedCss);
    });
  }

  /**
   * @private
   * @param {NonNullable<import('./types.js').InputMessageMap['selected-files-change']['selectedFiles']>[number]} selectedFile
   */
  extractUrlFromSelectedFile(selectedFile) {
    if (selectedFile.alternatives) {
      const preferredTypes = stringToArray(this.cfg.externalSourcesPreferredTypes);
      for (const preferredType of preferredTypes) {
        const regexp = wildcardRegexp(preferredType);
        for (const [type, typeUrl] of Object.entries(selectedFile.alternatives)) {
          if (regexp.test(type)) {
            return typeUrl;
          }
        }
      }
    }

    return selectedFile.url;
  }

  /**
   * @private
   * @param {import('./types.js').InputMessageMap['toolbar-state-change']} message
   */
  handleToolbarStateChange(message) {
    this.set$({
      toolbarVisible: message.isVisible,
    });
  }

  /**
   * @private
   * @param {import('./types.js').InputMessageMap['selected-files-change']} message
   */
  async handleSelectedFilesChange(message) {
    if (this.cfg.multiple !== message.isMultipleMode) {
      console.error('Multiple mode mismatch');
      return;
    }

    this.bindL10n('counterText', () =>
      this.l10n('selected-count', {
        count: message.selectedCount,
        total: message.total,
      }),
    );

    this.set$({
      doneBtnTextClass: message.isReady ? '' : 'uc-hidden',
      isSelectionReady: message.isReady,
      isDoneBtnEnabled: message.isReady && message.selectedFiles.length > 0,
      showSelectionStatus: message.isMultipleMode && message.total > 0,
      couldSelectAll: message.selectedCount < message.total,
      couldDeselectAll: message.selectedCount === message.total,
      selectedList: message.selectedFiles,
    });
  }

  /** @private */
  handleIframeLoad() {
    this.applyEmbedCss(this.cfg.externalSourcesEmbedCss);
    this.applyTheme();
    this.setupL10n();
  }

  /** @private */
  applyTheme() {
    this._messageBridge?.send({
      type: 'set-theme-definition',
      theme: buildThemeDefinition(this),
    });
  }

  /**
   * @private
   * @param {string} css
   */
  applyEmbedCss(css) {
    this._messageBridge?.send({
      type: 'set-embed-css',
      css,
    });
  }

  /** @private */
  setupL10n() {
    this._messageBridge?.send({
      type: 'set-locale-definition',
      localeDefinition: this.cfg.localeName,
    });
  }

  /** @private */
  remoteUrl() {
    const { pubkey, remoteTabSessionKey, socialBaseUrl, multiple } = this.cfg;
    const { externalSourceType } = this.activityParams;
    const sourceName = SOCIAL_SOURCE_MAPPING[externalSourceType] ?? externalSourceType;
    const lang = this.l10n('social-source-lang')?.split('-')?.[0] || 'en';
    const params = {
      lang,
      public_key: pubkey,
      images_only: false.toString(),
      session_key: remoteTabSessionKey,
      wait_for_theme: true,
      multiple: multiple.toString(),
      origin: this.cfg.topLevelOrigin || getTopLevelOrigin(),
      debug: this.cfg.debug,
    };
    const url = new URL(`/window4/${sourceName}`, socialBaseUrl);
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

    if (!iframe.contentWindow) {
      return;
    }

    this._messageBridge?.destroy();

    /** @private */
    this._messageBridge = new MessageBridge(iframe.contentWindow);
    this._messageBridge.on('selected-files-change', this.handleSelectedFilesChange.bind(this));
    this._messageBridge.on('toolbar-state-change', this.handleToolbarStateChange.bind(this));

    this.resetSelectionStatus();
  }

  /** @private */
  unmountIframe() {
    this._messageBridge?.destroy();
    this._messageBridge = undefined;
    this.ref.iframeWrapper.innerHTML = '';

    this.resetSelectionStatus();
  }

  /** @private */
  resetSelectionStatus() {
    this.set$({
      selectedList: [],
      total: 0,
      isDoneBtnEnabled: false,
      couldSelectAll: false,
      couldDeselectAll: false,
      showSelectionStatus: false,
    });
  }
}

ExternalSource.template = /* HTML */ `
  <uc-activity-header>
    <button
      type="button"
      class="uc-mini-btn uc-close-btn"
      set="onclick: *historyBack"
      l10n="@title:a11y-activity-header-button-close;@aria-label:a11y-activity-header-button-close"
    >
      <uc-icon name="close"></uc-icon>
    </button>
  </uc-activity-header>
  <div class="uc-content">
    <div ref="iframeWrapper" class="uc-iframe-wrapper"></div>
    <div class="uc-toolbar" set="@hidden: !toolbarVisible">
      <button type="button" class="uc-cancel-btn uc-secondary-btn" set="onclick: onCancel" l10n="cancel"></button>
      <div set="@hidden: !showSelectionStatus" class="uc-selection-status-box">
        <span>{{counterText}}</span>
        <button type="button" set="onclick: onSelectAll; @hidden: !couldSelectAll" l10n="select-all"></button>
        <button type="button" set="onclick: onDeselectAll; @hidden: !couldDeselectAll" l10n="deselect-all"></button>
      </div>
      <button type="button" class="uc-done-btn uc-primary-btn" set="onclick: onDone; @disabled: !isDoneBtnEnabled;">
        <uc-spinner set="@hidden: isSelectionReady"></uc-spinner>
        <span l10n="done" set="@class: doneBtnTextClass"></span>
      </button>
    </div>
  </div>
`;
