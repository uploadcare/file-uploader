import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { buildThemeDefinition } from '../../blocks/ExternalSource/buildThemeDefinition';
import '../../blocks/ExternalSource/external-source.css';
import { MessageBridge } from '../../blocks/ExternalSource/MessageBridge';
import { queryString } from '../../blocks/ExternalSource/query-string';
import type { InputMessageMap } from '../../blocks/ExternalSource/types';
import { getTopLevelOrigin } from '../../utils/get-top-level-origin';
import { stringToArray } from '../../utils/stringToArray';
import { ExternalUploadSource } from '../../utils/UploadSource';
import { wildcardRegexp } from '../../utils/wildcardRegexp';
import '../ActivityHeader/ActivityHeader';
import '../Icon/Icon';
import '../Spinner/Spinner';
import { ChildBlock } from '../../abstract/ChildBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';

/** v1-shaped re-export — activity routing params for the external-source activity. */
export type ActivityParams = { externalSourceType: string };

const SOCIAL_SOURCE_MAPPING: Record<string, string> = {
  [ExternalUploadSource.GDRIVE]: 'ngdrive',
};

type CfgSlice = {
  pubkey?: string;
  remoteTabSessionKey?: string;
  socialBaseUrl?: string;
  multiple?: boolean;
  topLevelOrigin?: string;
  debug?: boolean;
  externalSourcesPreferredTypes?: string;
  externalSourcesEmbedCss?: string;
  localeName?: string;
};

/**
 * v2 `<uc-external-source>`. Port of v1's ExternalSource — iframe to the
 * Uploadcare social hub + selection toolbar + theming bridge. Extends
 * v2's ChildBlock; the activity param (`externalSourceType`) flows in
 * as a Lit property when the plugin mounts the element. v1's
 * `external-source.css` styles the tag directly.
 */
export class ExternalSource extends ChildBlock {
  @property({ type: String, attribute: 'external-source-type' })
  public externalSourceType = '';

  private _messageBridge?: MessageBridge;
  private _iframeRef = createRef<HTMLDivElement>();
  private _latestSelectionSummary: { selectedCount: number; total: number } | null = null;
  private _unsubConfig?: () => void;

  @state()
  private _selectedList: NonNullable<InputMessageMap['selected-files-change']['selectedFiles']> = [];

  @state() private _isSelectionReady = false;
  @state() private _isDoneBtnEnabled = false;
  @state() private _couldSelectAll = false;
  @state() private _couldDeselectAll = false;
  @state() private _showSelectionStatus = false;
  @state() private _showDoneBtn = false;
  @state() private _doneBtnTextClass = 'uc-hidden';
  @state() private _toolbarVisible = true;

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [ctrl.locale.subscribe.bind(ctrl.locale)];
  }

  private _cfg(): CfgSlice {
    return (this.uploaderOrNull?.config.values ?? {}) as CfgSlice;
  }

  private _t(key: string, vars?: Record<string, unknown>): string {
    return this.uploaderOrNull?.locale.t(key, vars) ?? key;
  }

  private get _counterText(): string {
    if (!this._latestSelectionSummary) return '';
    const { selectedCount, total } = this._latestSelectionSummary;
    return this._t('selected-count', { count: selectedCount, total });
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────

  protected override controllerReady(ctrl: UploaderController): void {
    if (!this.externalSourceType) {
      console.error('Param "externalSourceType" is required for external source activity');
    } else {
      this._mountIframe();
    }
    let prev = { ...ctrl.config.values } as CfgSlice;
    this._showSelectionStatus = !!prev.multiple;
    this._unsubConfig = ctrl.config.subscribe(() => {
      const next = ctrl.config.values as CfgSlice;
      if (next.multiple !== prev.multiple) this._showSelectionStatus = !!next.multiple;
      if (next.localeName !== prev.localeName) this._setupL10n();
      if (next.externalSourcesEmbedCss !== prev.externalSourcesEmbedCss) {
        this._applyEmbedCss(next.externalSourcesEmbedCss ?? '');
      }
      prev = { ...ctrl.config.values } as CfgSlice;
    });
  }

  public override updated(changed: Map<PropertyKey, unknown>): void {
    super.updated?.(changed);
    if (changed.has('externalSourceType') && this.externalSourceType && this.uploaderOrNull) {
      this._unmountIframe();
      this._mountIframe();
    }
  }

  public override disconnectedCallback(): void {
    this._unmountIframe();
    this._unsubConfig?.();
    super.disconnectedCallback();
  }

  // ─── Bridge / iframe ─────────────────────────────────────────────────

  private _extractUrlFromSelectedFile(
    selectedFile: NonNullable<InputMessageMap['selected-files-change']['selectedFiles']>[number],
  ): string {
    if (selectedFile.alternatives) {
      const preferredTypes = stringToArray(this._cfg().externalSourcesPreferredTypes ?? '');
      for (const preferredType of preferredTypes) {
        const regexp = wildcardRegexp(preferredType);
        for (const [type, typeUrl] of Object.entries(selectedFile.alternatives)) {
          if (regexp.test(type)) return typeUrl;
        }
      }
    }
    return selectedFile.url;
  }

  private _handleToolbarStateChange = (message: InputMessageMap['toolbar-state-change']): void => {
    this._toolbarVisible = message.isVisible;
  };

  private _handleSelectedFilesChange = (message: InputMessageMap['selected-files-change']): void => {
    if (this._cfg().multiple !== message.isMultipleMode) {
      console.error('Multiple mode mismatch');
      return;
    }
    this._latestSelectionSummary = { selectedCount: message.selectedCount, total: message.total };
    this._doneBtnTextClass = message.isReady ? '' : 'uc-hidden';
    this._isSelectionReady = message.isReady;
    this._isDoneBtnEnabled = message.isReady && message.selectedFiles.length > 0;
    this._showSelectionStatus = message.isMultipleMode && message.total > 0;
    this._couldSelectAll = message.selectedCount < message.total;
    this._couldDeselectAll = message.selectedCount === message.total;
    this._selectedList = message.selectedFiles ?? [];
    this._showDoneBtn = message.total > 0;
  };

  private _handleIframeLoad = (): void => {
    this._applyEmbedCss(this._cfg().externalSourcesEmbedCss ?? '');
    this._applyTheme();
    this._setupL10n();
  };

  private _applyTheme(): void {
    this._messageBridge?.send({
      type: 'set-theme-definition',
      theme: buildThemeDefinition(this),
    });
  }

  private _applyEmbedCss(css: string): void {
    this._messageBridge?.send({ type: 'set-embed-css', css });
  }

  private _setupL10n(): void {
    this._messageBridge?.send({
      type: 'set-locale-definition',
      localeDefinition: this._cfg().localeName ?? 'en',
    });
  }

  private _remoteUrl(): string {
    const cfg = this._cfg();
    const sourceName = SOCIAL_SOURCE_MAPPING[this.externalSourceType] ?? this.externalSourceType;
    const lang = this._t('social-source-lang')?.split('-')?.[0] || 'en';
    const params = {
      lang,
      public_key: cfg.pubkey,
      images_only: 'false',
      session_key: cfg.remoteTabSessionKey,
      wait_for_theme: true,
      multiple: String(!!cfg.multiple),
      origin: cfg.topLevelOrigin || getTopLevelOrigin(),
      debug: cfg.debug,
    };
    const url = new URL(`/window4/${sourceName}`, cfg.socialBaseUrl);
    url.search = queryString(params);
    return url.toString();
  }

  private _handleDone = (): void => {
    for (const message of this._selectedList) {
      const url = this._extractUrlFromSelectedFile(message);
      const { filename } = message;
      this.uploader.api.addFileFromUrl(url, {
        fileName: filename,
        source: this.externalSourceType,
      });
    }
    this.uploader.router.traverse('onDone');
  };

  private _handleCancel = (): void => {
    this.uploader.router.traverse('onCancel');
  };

  private _handleClose = (): void => {
    this.uploader.api.close();
  };

  private _handleSelectAll = (): void => {
    this._messageBridge?.send({ type: 'select-all' });
  };

  private _handleDeselectAll = (): void => {
    this._messageBridge?.send({ type: 'deselect-all' });
  };

  private _mountIframe(): void {
    const iframe = document.createElement('iframe');
    iframe.src = this._remoteUrl();
    (iframe as unknown as { marginHeight: number }).marginHeight = 0;
    (iframe as unknown as { marginWidth: number }).marginWidth = 0;
    iframe.frameBorder = '0';
    (iframe as unknown as { allowTransparency: boolean }).allowTransparency = true;
    iframe.addEventListener('load', this._handleIframeLoad);
    if (this._iframeRef.value) {
      this._iframeRef.value.innerHTML = '';
      this._iframeRef.value.appendChild(iframe);
    }
    if (!iframe.contentWindow) return;
    this._messageBridge?.destroy();
    this._messageBridge = new MessageBridge(iframe.contentWindow, () => this._cfg().socialBaseUrl ?? '');
    this._messageBridge.on('selected-files-change', this._handleSelectedFilesChange);
    this._messageBridge.on('toolbar-state-change', this._handleToolbarStateChange);
    this._resetSelectionStatus();
  }

  private _unmountIframe(): void {
    this._messageBridge?.destroy();
    this._messageBridge = undefined;
    if (this._iframeRef.value) this._iframeRef.value.innerHTML = '';
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

  public override render() {
    return html`
      <uc-activity-header>
        <button
          type="button"
          class="uc-mini-btn uc-close-btn"
          @click=${this._handleClose}
          title=${this._t('a11y-activity-header-button-close')}
          aria-label=${this._t('a11y-activity-header-button-close')}
        >
          <uc-icon name="close"></uc-icon>
        </button>
      </uc-activity-header>
      <div class="uc-content">
        <div ${ref(this._iframeRef)} class="uc-iframe-wrapper"></div>
        <div class="uc-toolbar" ?hidden=${!this._toolbarVisible}>
          <button
            type="button"
            class="uc-cancel-btn uc-secondary-btn"
            @click=${this._handleCancel}
          >${this._t('cancel')}</button>
          <div class="uc-selection-status-box" ?hidden=${!this._showSelectionStatus}>
            <span>${this._counterText}</span>
            <button
              type="button"
              @click=${this._handleSelectAll}
              ?hidden=${!this._couldSelectAll}
            >${this._t('select-all')}</button>
            <button
              type="button"
              @click=${this._handleDeselectAll}
              ?hidden=${!this._couldDeselectAll}
            >${this._t('deselect-all')}</button>
          </div>
          <button
            type="button"
            class="uc-done-btn uc-primary-btn"
            @click=${this._handleDone}
            ?disabled=${!this._isDoneBtnEnabled}
            ?hidden=${!this._showDoneBtn}
          >
            <uc-spinner ?hidden=${this._isSelectionReady}></uc-spinner>
            <span class=${this._doneBtnTextClass}>${this._t('done')}</span>
          </button>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('uc-external-source')) customElements.define('uc-external-source', ExternalSource);
