import { getTopLevelOrigin } from '../../utils/get-top-level-origin';
import { stringToArray } from '../../utils/stringToArray';
import { ExternalUploadSource } from '../../utils/UploadSource';
import { wildcardRegexp } from '../../utils/wildcardRegexp';
import { buildThemeDefinition } from './buildThemeDefinition';
import './external-source.css';
import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { inject } from '../../abstract/di/inject';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { ChildBlock } from '../../lit/ChildBlock';
import { effect } from '../../lit/effect';
import { subscription, type Unsubscribe } from '../../lit/subscription';
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

export class ExternalSource extends ChildBlock {
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(RouterController) private readonly _router!: RouterController;
  // `api` (UploaderPublicApi) is host-boundary state with no dedicated DI
  // token — it is container-resolved (M-god step 8a), injected via `@inject`.
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;

  private _messageBridge?: MessageBridge;

  private _iframeRef = createRef<HTMLIFrameElement>();
  private _latestSelectionSummary: {
    selectedCount: number;
    total: number;
  } | null = null;

  private _lastActivityParams: Readonly<Record<string, unknown>> | undefined = undefined;

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

  // Derived: the selection-status box shows only in multiple mode once the
  // iframe reports a non-empty selection. A pure function of config `multiple`
  // (tracked) + the latest selection summary — same reactive coupling as
  // `_counterText` (every `_latestSelectionSummary` write rides with sibling
  // `@state` writes that re-render).
  private get _showSelectionStatus(): boolean {
    return this._config.getTracked('multiple') && (this._latestSelectionSummary?.total ?? 0) > 0;
  }

  protected override controllerReady(): void {
    // The iframe container ref only exists after the first render, so the
    // initial mount is deferred a tick (v1 relied on its immediate-fire
    // params subscription for exactly this — its pre-render direct
    // `_mountIframe()` call was a no-op against an empty ref).
    this._lastActivityParams = this._router.params;
    setTimeout(() => {
      if (!this.isConnected) {
        return;
      }
      const { externalSourceType } = this._router.params as ActivityParams;
      if (!externalSourceType) {
        this._log.error(`Param "externalSourceType" is required for external source activity`);
        return;
      }
      this._unmountIframe();
      this._mountIframe();
    });
  }

  // Remount the iframe when the activity params change.
  @subscription()
  protected _wireParamsRemount(): Unsubscribe {
    return this._router.subscribe(() => {
      const params = this._router.params;
      if (params === this._lastActivityParams) {
        return;
      }
      this._lastActivityParams = params;
      setTimeout(() => {
        // Defer a tick before reacting to a params change: the router updates
        // params and the current activity together in one transition, so a
        // params change that coincides with navigating *away* from this activity
        // would otherwise remount the iframe just as this block is being torn
        // down. Waiting a tick lets that disconnect settle so we can bail here.
        if (!this.isConnected) {
          return;
        }
        this._unmountIframe();
        this._mountIframe();
      });
    });
  }

  // Two side-effecting config reactions, expressed as `@effect` methods: each
  // re-runs when the config key it reads via `getTracked` changes (auto-tracked,
  // auto-disposed on release), posting `localeName` / `externalSourcesEmbedCss`
  // into the iframe. `_handleIframeLoad` also calls them directly to push the
  // current values to a freshly-mounted iframe.
  @effect()
  protected _syncLocale(): void {
    this._messageBridge?.send({
      type: 'set-locale-definition',
      localeDefinition: this._config.getTracked('localeName'),
    });
  }

  @effect()
  protected _syncEmbedCss(): void {
    this._messageBridge?.send({
      type: 'set-embed-css',
      css: this._config.getTracked('externalSourcesEmbedCss'),
    });
  }

  private _extractUrlFromSelectedFile(
    selectedFile: NonNullable<InputMessageMap['selected-files-change']['selectedFiles']>[number],
  ): string {
    if (selectedFile.alternatives) {
      const preferredTypes = stringToArray(this._config.get('externalSourcesPreferredTypes'));
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
    if (this._config.get('multiple') !== message.isMultipleMode) {
      this._log.error('Multiple mode mismatch');
      return;
    }

    this._setSelectionSummary(message.selectedCount, message.total);

    this._doneBtnTextClass = message.isReady ? '' : 'uc-hidden';
    this._isSelectionReady = message.isReady;
    this._isDoneBtnEnabled = message.isReady && message.selectedFiles.length > 0;
    this._couldSelectAll = message.selectedCount < message.total;
    this._couldDeselectAll = message.selectedCount === message.total;
    this._selectedList = message.selectedFiles ?? [];
    this._showDoneBtn = message.total > 0;
  }

  private _handleIframeLoad(): void {
    this._syncEmbedCss();
    this._applyTheme();
    this._syncLocale();
  }

  private _applyTheme(): void {
    this._messageBridge?.send({
      type: 'set-theme-definition',
      theme: buildThemeDefinition(this),
    });
  }

  private _remoteUrl(): string {
    const pubkey = this._config.get('pubkey');
    const remoteTabSessionKey = this._config.get('remoteTabSessionKey');
    const socialBaseUrl = this._config.get('socialBaseUrl');
    const multiple = this._config.get('multiple');
    const { externalSourceType } = this._router.params as ActivityParams;
    if (!externalSourceType) {
      throw new Error(`Param "externalSourceType" is required for external source activity`);
    }
    const sourceName = SOCIAL_SOURCE_MAPPING[externalSourceType] ?? externalSourceType;
    const lang = this.l10n('social-source-lang')?.split('-')?.[0] || 'en';
    const params = {
      lang,
      public_key: pubkey,
      images_only: false.toString(),
      session_key: remoteTabSessionKey,
      wait_for_theme: true,
      multiple: multiple.toString(),
      origin: this._config.get('topLevelOrigin') || getTopLevelOrigin(),
      debug: this._config.get('debug'),
    };
    const url = new URL(`/window4/${sourceName}`, socialBaseUrl);
    url.search = queryString(params);
    return url.toString();
  }

  private _handleDone = (): void => {
    for (const message of this._selectedList) {
      const url = this._extractUrlFromSelectedFile(message);
      const { filename } = message;
      const { externalSourceType } = this._router.params as ActivityParams;
      if (!externalSourceType) {
        throw new Error(`Param "externalSourceType" is required for external source activity`);
      }
      this._api.addFileFromUrl(url, {
        fileName: filename,
        source: externalSourceType,
      });
    }

    this._router.traverse('onFileAdd');
  };

  private _handleCancel = (): void => {
    this._router.traverse('onCancel');
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

    if (this._iframeRef.value) {
      this._iframeRef.value.innerHTML = '';
      this._iframeRef.value.appendChild(iframe);
    }

    if (!iframe.contentWindow) {
      return;
    }

    this._messageBridge?.destroy();

    this._messageBridge = new MessageBridge(iframe.contentWindow, () => this._config.get('socialBaseUrl'));
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
    this._showDoneBtn = false;
    this._doneBtnTextClass = 'uc-hidden';
    this._latestSelectionSummary = null;
  }

  // The iframe + `MessageBridge` mount is adoption-scoped (`controllerReady` and
  // the `@subscription _wireParamsRemount`), so tear it down in `controllerReleased`
  // — invoked on disconnect (via the base `disconnectedCallback` →
  // `_releaseController`) and additionally on ctx release/re-adoption.
  protected override controllerReleased(): void {
    this._unmountIframe();
  }

  public override render() {
    return html`
      <uc-activity-header>
        <button
          type="button"
          class="uc-mini-btn uc-close-btn"
          @click=${() => this._router.traverse('onClose')}
          title=${this.l10n('a11y-activity-header-button-close')}
          aria-label=${this.l10n('a11y-activity-header-button-close')}
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
          >
            ${this.l10n('cancel')}
          </button>
          <div
            class="uc-selection-status-box"
            ?hidden=${!this._showSelectionStatus}
          >
            <span>${this._counterText}</span>
            <button
              type="button"
              @click=${this._handleSelectAll}
              ?hidden=${!this._couldSelectAll}
            >
              ${this.l10n('select-all')}
            </button>
            <button
              type="button"
              @click=${this._handleDeselectAll}
              ?hidden=${!this._couldDeselectAll}
            >
              ${this.l10n('deselect-all')}
            </button>
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
