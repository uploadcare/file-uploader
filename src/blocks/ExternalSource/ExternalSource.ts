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

const SOCIAL_SOURCE_MAPPING: Record<string, string> = {
  [ExternalUploadSource.GDRIVE]: 'ngdrive',
};

export type ActivityParams = { externalSourceType: string };

export class ExternalSource extends LitUploaderBlock {
  override couldBeCtxOwner = true;
  override activityType = LitActivityBlock.activities.EXTERNAL;
  private _messageBridge?: MessageBridge;

  private iframeRef = createRef<HTMLIFrameElement>();
  private _latestSelectionSummary: { selectedCount: number; total: number } | null = null;

  @state()
  private selectedList: NonNullable<InputMessageMap['selected-files-change']['selectedFiles']> = [];

  @state()
  private isSelectionReady = false;

  @state()
  private isDoneBtnEnabled = false;

  @state()
  private couldSelectAll = false;

  @state()
  private couldDeselectAll = false;

  @state()
  private showSelectionStatus = false;

  @state()
  private showDoneBtn = false;

  @state()
  private doneBtnTextClass = 'uc-hidden';

  @state()
  private toolbarVisible = true;

  private get counterText(): string {
    if (!this._latestSelectionSummary) {
      return '';
    }

    const { selectedCount, total } = this._latestSelectionSummary;
    return this.l10n('selected-count', {
      count: selectedCount,
      total,
    });
  }

  override get activityParams(): ActivityParams {
    const params = super.activityParams;
    if ('externalSourceType' in params) {
      return params as ActivityParams;
    }
    throw new Error(`External Source activity params not found`);
  }

  override initCallback(): void {
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

        this.mountIframe();
      },
    });
    this.sub('*currentActivityParams', () => {
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
      this.showSelectionStatus = multiple;
    });

    this.subConfigValue('localeName', () => {
      this.setupL10n();
    });

    this.subConfigValue('externalSourcesEmbedCss', (embedCss) => {
      this.applyEmbedCss(embedCss);
    });
  }

  private extractUrlFromSelectedFile(
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

  private handleToolbarStateChange(message: InputMessageMap['toolbar-state-change']): void {
    this.toolbarVisible = message.isVisible;
  }

  private async handleSelectedFilesChange(message: InputMessageMap['selected-files-change']) {
    if (this.cfg.multiple !== message.isMultipleMode) {
      console.error('Multiple mode mismatch');
      return;
    }

    this._setSelectionSummary(message.selectedCount, message.total);

    this.doneBtnTextClass = message.isReady ? '' : 'uc-hidden';
    this.isSelectionReady = message.isReady;
    this.isDoneBtnEnabled = message.isReady && message.selectedFiles.length > 0;
    this.showSelectionStatus = message.isMultipleMode && message.total > 0;
    this.couldSelectAll = message.selectedCount < message.total;
    this.couldDeselectAll = message.selectedCount === message.total;
    this.selectedList = message.selectedFiles ?? [];
    this.showDoneBtn = message.total > 0;
  }

  private handleIframeLoad(): void {
    this.applyEmbedCss(this.cfg.externalSourcesEmbedCss);
    this.applyTheme();
    this.setupL10n();
  }

  private applyTheme(): void {
    this._messageBridge?.send({
      type: 'set-theme-definition',
      theme: buildThemeDefinition(this),
    });
  }

  private applyEmbedCss(css: string): void {
    this._messageBridge?.send({
      type: 'set-embed-css',
      css,
    });
  }

  private setupL10n(): void {
    this._messageBridge?.send({
      type: 'set-locale-definition',
      localeDefinition: this.cfg.localeName,
    });
  }

  private remoteUrl(): string {
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
    for (const message of this.selectedList) {
      const url = this.extractUrlFromSelectedFile(message);
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

  private mountIframe(): void {
    const iframe = document.createElement('iframe');
    iframe.src = this.remoteUrl();
    // @ts-expect-error
    iframe.marginHeight = 0;
    // @ts-expect-error
    iframe.marginWidth = 0;
    iframe.frameBorder = '0';
    // @ts-expect-error
    iframe.allowTransparency = true;
    iframe.addEventListener('load', this.handleIframeLoad.bind(this));

    iframe.addEventListener('load', this.handleIframeLoad.bind(this));

    if (this.iframeRef.value) {
      this.iframeRef.value.innerHTML = '';
      this.iframeRef.value.appendChild(iframe);
    }

    if (!iframe.contentWindow) {
      return;
    }

    this._messageBridge?.destroy();

    this._messageBridge = new MessageBridge(iframe.contentWindow, () => this.cfg.socialBaseUrl);
    this._messageBridge.on('selected-files-change', this.handleSelectedFilesChange.bind(this));
    this._messageBridge.on('toolbar-state-change', this.handleToolbarStateChange.bind(this));

    this.resetSelectionStatus();
  }

  private unmountIframe(): void {
    this._messageBridge?.destroy();
    this._messageBridge = undefined;
    if (this.iframeRef.value) {
      this.iframeRef.value.innerHTML = '';
    }

    this.resetSelectionStatus();
  }

  private resetSelectionStatus(): void {
    this.selectedList = [];
    this.isSelectionReady = false;
    this.isDoneBtnEnabled = false;
    this.couldSelectAll = false;
    this.couldDeselectAll = false;
    this.showSelectionStatus = false;
    this.showDoneBtn = false;
    this.doneBtnTextClass = 'uc-hidden';
    this._latestSelectionSummary = null;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unmountIframe();
  }

  override render() {
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
          <div ${ref(this.iframeRef)} class="uc-iframe-wrapper"></div>
          <div class="uc-toolbar" ?hidden=${!this.toolbarVisible}>
            <button type="button" class="uc-cancel-btn uc-secondary-btn" @click=${this._handleCancel}>${this.l10n('cancel')}</button>
            <div class="uc-selection-status-box" ?hidden=${!this.showSelectionStatus}>
              <span>${this.counterText}</span>
              <button type="button" @click=${this._handleSelectAll} ?hidden=${!this.couldSelectAll}>${this.l10n('select-all')}</button>
              <button type="button" @click=${this._handleDeselectAll} ?hidden=${!this.couldDeselectAll}>${this.l10n('deselect-all')}</button>
            </div>
            <button
              type="button"
              class="uc-done-btn uc-primary-btn"
              @click=${this._handleDone}
              ?disabled=${!this.isDoneBtnEnabled}
              ?hidden=${!this.showDoneBtn}
            >
              <uc-spinner ?hidden=${this.isSelectionReady} ></uc-spinner>
              <span class=${this.doneBtnTextClass}>${this.l10n('done')}</span>
            </button>
          </div>
        </div>
    `;
  }
}
