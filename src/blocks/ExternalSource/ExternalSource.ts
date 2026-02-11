import { LitActivityBlock } from '../../lit/LitActivityBlock';
import { getTopLevelOrigin } from '../../utils/get-top-level-origin';
import { stringToArray } from '../../utils/stringToArray';
import { ExternalUploadSource } from '../../utils/UploadSource';
import { wildcardRegexp } from '../../utils/wildcardRegexp';
import { buildThemeDefinition } from './buildThemeDefinition';
import './external-source.css';
import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import { MessageBridge } from './MessageBridge';
import { queryString } from './query-string';
import type { InputMessageMap } from './types';

import '../ActivityHeader/ActivityHeader';
import '../Icon/Icon';
import '../Spinner/Spinner';

const SOCIAL_SOURCE_MAPPING: Record<string, string> = {
  [ExternalUploadSource.GDRIVE]: 'ngdrive',
};

export type ActivityParams = { externalSourceType: string };

export class ExternalSource extends LitUploaderBlock {
  public override couldBeCtxOwner = true;
  public override activityType = LitActivityBlock.activities.EXTERNAL;
  private _messageBridge?: MessageBridge;

  private _iframeRef = createRef<HTMLIFrameElement>();
  private _latestSelectionSummary: { selectedCount: number; total: number } | null = null;

  @state()
  private _selectedList: NonNullable<InputMessageMap['selected-files-change']['selectedFiles']> = [];

  @state()
  private _isSelectionReady = false;

  @state()
  private _isDoneBtnEnabled = false;

  @state()
  private _couldSelectAll = false;

  @state()
  private _couldDeselectAll = false;

  @state()
  private _showSelectionStatus = false;

  @state()
  private _showDoneBtn = false;

  @state()
  private _doneBtnTextClass = 'uc-hidden';

  @state()
  private _toolbarVisible = true;

  private get _counterText(): string {
    if (!this._latestSelectionSummary) {
      return '';
    }

    const { selectedCount, total } = this._latestSelectionSummary;
    return this.l10n('selected-count', {
      count: selectedCount,
      total,
    });
  }

  public override get activityParams(): ActivityParams {
    const params = super.activityParams;
    if ('externalSourceType' in params) {
      return params as ActivityParams;
    }
    throw new Error(`External Source activity params not found`);
  }

  public override initCallback(): void {
    super.initCallback();
    this.registerActivity(this.activityType, {
      onActivate: () => {
        const { externalSourceType } = this.activityParams;

        if (!externalSourceType) {
          this.modalManager?.close(this.$['*currentActivity']);
          this.$['*currentActivity'] = null;
          console.error(`Param "externalSourceType" is required for activity "${this.activityType}"`);
          return;
        }

        this._mountIframe();
      },
    });
    this.sub('*currentActivityParams', () => {
      setTimeout(() => {
        // Since activity params are set before current activity, we need to wait for the next tick to ensure that the activity is still active before processing the params change.
        // Otherwise, if the activity was changed, we might end up mounting the iframe with params from the next activity.
        if (!this.isActivityActive || !this.isConnected) {
          return;
        }
        this._unmountIframe();
        this._mountIframe();
      });
    });
    this.sub('*currentActivity', (val) => {
      if (val !== this.activityType) {
        this._unmountIframe();
      }
    });
    this.subConfigValue('multiple', (multiple) => {
      this._showSelectionStatus = multiple;
    });

    this.subConfigValue('localeName', () => {
      this._setupL10n();
    });

    this.subConfigValue('externalSourcesEmbedCss', (embedCss) => {
      this._applyEmbedCss(embedCss);
    });
  }

  private _extractUrlFromSelectedFile(
    selectedFile: NonNullable<InputMessageMap['selected-files-change']['selectedFiles']>[number],
  ): string {
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

  private _handleToolbarStateChange(message: InputMessageMap['toolbar-state-change']): void {
    this._toolbarVisible = message.isVisible;
  }

  private async _handleSelectedFilesChange(message: InputMessageMap['selected-files-change']) {
    if (this.cfg.multiple !== message.isMultipleMode) {
      console.error('Multiple mode mismatch');
      return;
    }

    this._setSelectionSummary(message.selectedCount, message.total);

    this._doneBtnTextClass = message.isReady ? '' : 'uc-hidden';
    this._isSelectionReady = message.isReady;
    this._isDoneBtnEnabled = message.isReady && message.selectedFiles.length > 0;
    this._showSelectionStatus = message.isMultipleMode && message.total > 0;
    this._couldSelectAll = message.selectedCount < message.total;
    this._couldDeselectAll = message.selectedCount === message.total;
    this._selectedList = message.selectedFiles ?? [];
    this._showDoneBtn = message.total > 0;
  }

  private _handleIframeLoad(): void {
    this._applyEmbedCss(this.cfg.externalSourcesEmbedCss);
    this._applyTheme();
    this._setupL10n();
  }

  private _applyTheme(): void {
    this._messageBridge?.send({
      type: 'set-theme-definition',
      theme: buildThemeDefinition(this),
    });
  }

  private _applyEmbedCss(css: string): void {
    this._messageBridge?.send({
      type: 'set-embed-css',
      css,
    });
  }

  private _setupL10n(): void {
    this._messageBridge?.send({
      type: 'set-locale-definition',
      localeDefinition: this.cfg.localeName,
    });
  }

  private _remoteUrl(): string {
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

  private _handleDone = (): void => {
    for (const message of this._selectedList) {
      const url = this._extractUrlFromSelectedFile(message);
      const { filename } = message;
      const { externalSourceType } = this.activityParams;
      this.api.addFileFromUrl(url, { fileName: filename, source: externalSourceType });
    }

    this.$['*currentActivity'] = LitActivityBlock.activities.UPLOAD_LIST;
    this.modalManager?.open(LitActivityBlock.activities.UPLOAD_LIST);
  };

  private _handleCancel = (): void => {
    this.historyBack();
  };

  private _handleSelectAll = (): void => {
    this._messageBridge?.send({ type: 'select-all' });
  };

  private _handleDeselectAll = (): void => {
    this._messageBridge?.send({ type: 'deselect-all' });
  };

  private _setSelectionSummary(selectedCount: number, total: number): void {
    this._latestSelectionSummary = { selectedCount, total };
  }

  private _mountIframe(): void {
    const iframe = document.createElement('iframe');
    iframe.src = this._remoteUrl();
    // @ts-expect-error
    iframe.marginHeight = 0;
    // @ts-expect-error
    iframe.marginWidth = 0;
    iframe.frameBorder = '0';
    // @ts-expect-error
    iframe.allowTransparency = true;
    iframe.addEventListener('load', this._handleIframeLoad.bind(this));

    iframe.addEventListener('load', this._handleIframeLoad.bind(this));

    if (this._iframeRef.value) {
      this._iframeRef.value.innerHTML = '';
      this._iframeRef.value.appendChild(iframe);
    }

    if (!iframe.contentWindow) {
      return;
    }

    this._messageBridge?.destroy();

    this._messageBridge = new MessageBridge(iframe.contentWindow, () => this.cfg.socialBaseUrl);
    this._messageBridge.on('selected-files-change', this._handleSelectedFilesChange.bind(this));
    this._messageBridge.on('toolbar-state-change', this._handleToolbarStateChange.bind(this));

    this._resetSelectionStatus();
  }

  private _unmountIframe(): void {
    this._messageBridge?.destroy();
    this._messageBridge = undefined;
    if (this._iframeRef.value) {
      this._iframeRef.value.innerHTML = '';
    }

    this._resetSelectionStatus();
  }

  private _resetSelectionStatus(): void {
    this._selectedList = [];
    this._isSelectionReady = false;
    this._isDoneBtnEnabled = false;
    this._couldSelectAll = false;
    this._couldDeselectAll = false;
    this._showSelectionStatus = false;
    this._showDoneBtn = false;
    this._doneBtnTextClass = 'uc-hidden';
    this._latestSelectionSummary = null;
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unmountIframe();
  }

  public override render() {
    return html`
      <uc-activity-header>
          <button
            type="button"
            class="uc-mini-btn uc-close-btn"
            @click=${this.$['*historyBack']}
            title=${this.l10n('a11y-activity-header-button-close')}
            aria-label=${this.l10n('a11y-activity-header-button-close')}
          >
            <uc-icon name="close"></uc-icon>
          </button>
        </uc-activity-header>
        <div class="uc-content">
          <div ${ref(this._iframeRef)} class="uc-iframe-wrapper"></div>
          <div class="uc-toolbar" ?hidden=${!this._toolbarVisible}>
            <button type="button" class="uc-cancel-btn uc-secondary-btn" @click=${this._handleCancel}>${this.l10n('cancel')}</button>
            <div class="uc-selection-status-box" ?hidden=${!this._showSelectionStatus}>
              <span>${this._counterText}</span>
              <button type="button" @click=${this._handleSelectAll} ?hidden=${!this._couldSelectAll}>${this.l10n('select-all')}</button>
              <button type="button" @click=${this._handleDeselectAll} ?hidden=${!this._couldDeselectAll}>${this.l10n('deselect-all')}</button>
            </div>
            <button
              type="button"
              class="uc-done-btn uc-primary-btn"
              @click=${this._handleDone}
              ?disabled=${!this._isDoneBtnEnabled}
              ?hidden=${!this._showDoneBtn}
            >
              <uc-spinner ?hidden=${this._isSelectionReady}></uc-spinner>
              <span class=${this._doneBtnTextClass}>${this.l10n('done')}</span>
            </button>
          </div>
        </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-external-source': ExternalSource;
  }
}
