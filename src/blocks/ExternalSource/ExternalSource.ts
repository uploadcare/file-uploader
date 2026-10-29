import { deserializeCsv } from '../../utils/comma-separated';
import { delay } from '../../utils/delay';
import { getTopLevelOrigin } from '../../utils/get-top-level-origin';
import { ExternalUploadSource, isExternalSource, sourceLabelKey } from '../../utils/UploadSource';
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
import type { ExternalSourceActivityParams } from '../../abstract/activity-constants';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';

const SOCIAL_SOURCE_MAPPING: Record<string, string> = {
  [ExternalUploadSource.GDRIVE]: 'ngdrive',
};

export type ActivityParams = ExternalSourceActivityParams;

export class ExternalSource extends ChildBlock {
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(RouterController) private readonly _router!: RouterController;
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;
  // `api` (UploaderPublicApi) is host-boundary state with no dedicated DI
  // token — it is container-resolved (M-god step 8a), injected via `@inject`.
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;

  private _messageBridge?: MessageBridge;

  private _iframeRef = createRef<HTMLIFrameElement>();
  private _lastActivityParams: Readonly<Record<string, unknown>> | undefined = undefined;

  /** The iframe's latest selection report; null until it sends one for the mounted iframe. */
  @state()
  private _selection: InputMessageMap['selected-files-change'] | null = null;

  @state()
  private _toolbarVisible = true;

  // Derived: the selection-status box shows only in multiple mode once the
  // iframe reports a non-empty selection.
  private get _showSelectionStatus(): boolean {
    return this._config.getTracked('multiple') && (this._selection?.total ?? 0) > 0;
  }

  protected override controllerReady(): void {
    // The iframe container ref only exists after the first render, so the
    // initial mount is deferred a tick (v1 relied on its immediate-fire
    // params subscription for exactly this — its pre-render direct
    // `_mountIframe()` call was a no-op against an empty ref).
    this._lastActivityParams = this._router.params;
    this.runTask(async () => {
      await this.whileAdopted(delay(0));
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
  /** @internal */
  @subscription()
  protected _wireParamsRemount(): Unsubscribe {
    return this._router.subscribe(() => {
      const params = this._router.params;
      if (params === this._lastActivityParams) {
        return;
      }
      this._lastActivityParams = params;
      this.runTask(async () => {
        // Defer a tick before reacting to a params change: the router updates
        // params and the current activity together in one transition, so a
        // params change that coincides with navigating *away* from this activity
        // would otherwise remount the iframe just as this block is being torn
        // down. Waiting a tick lets that release settle so the await aborts.
        await this.whileAdopted(delay(0));
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
  /** @internal */
  @effect()
  protected _syncLocale(): void {
    this._messageBridge?.send({
      type: 'set-locale-definition',
      localeDefinition: this._config.getTracked('localeName'),
    });
  }

  /** @internal */
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
      const preferredTypes = deserializeCsv(this._config.get('externalSourcesPreferredTypes'));
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

    this._selection = message;
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
    const { externalSourceType } = this._router.params as ActivityParams;
    if (!externalSourceType) {
      throw new Error(`Param "externalSourceType" is required for external source activity`);
    }
    const selected = this._selection?.selectedFiles ?? [];
    for (const message of selected) {
      const url = this._extractUrlFromSelectedFile(message);
      const { filename } = message;
      this._api.addFileFromUrl(url, {
        fileName: filename,
        source: externalSourceType,
      });
    }
    // Which source and how many files, never what they are.
    this._telemetry.sendActionEvent('select-external-files', this.tagName, {
      sourceId: externalSourceType,
      filesCount: selected.length,
    });

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

  private _mountIframe(): void {
    const iframe = document.createElement('iframe');
    iframe.src = this._remoteUrl();
    const { externalSourceType } = this._router.params as ActivityParams;
    iframe.title = this.l10n(
      isExternalSource(externalSourceType) ? sourceLabelKey(externalSourceType) : 'src-type-other',
    );
    // @ts-expect-error
    iframe.marginHeight = 0;
    // @ts-expect-error
    iframe.marginWidth = 0;
    iframe.frameBorder = '0';
    // @ts-expect-error
    iframe.allowTransparency = true;
    iframe.addEventListener('load', this._handleIframeLoad.bind(this));
    // Always called right after `_unmountIframe`, which emptied the wrapper and dropped the old bridge.
    this._iframeRef.value?.appendChild(iframe);
    if (!iframe.contentWindow) {
      return;
    }

    this._messageBridge = new MessageBridge(iframe.contentWindow, () => this._config.get('socialBaseUrl'));
    this._messageBridge.on('selected-files-change', this._handleSelectedFilesChange.bind(this));
    this._messageBridge.on('toolbar-state-change', this._handleToolbarStateChange.bind(this));

    this._selection = null;
  }

  private _unmountIframe(): void {
    this._messageBridge?.destroy();
    this._messageBridge = undefined;
    if (this._iframeRef.value) {
      this._iframeRef.value.innerHTML = '';
    }

    this._selection = null;
  }

  // The iframe + `MessageBridge` mount is adoption-scoped (`controllerReady` and
  // the `@subscription _wireParamsRemount`), so tear it down in `controllerReleased`
  // — invoked on disconnect (via the base `disconnectedCallback` →
  // `_releaseController`) and additionally on ctx release/re-adoption.
  protected override controllerReleased(): void {
    this._unmountIframe();
  }

  public override render() {
    const sel = this._selection;
    const ready = !!sel?.isReady;
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
            <span>${sel ? this.l10n('selected-count', { count: sel.selectedCount, total: sel.total }) : ''}</span>
            <button
              type="button"
              @click=${this._handleSelectAll}
              ?hidden=${!sel || sel.selectedCount >= sel.total}
            >
              ${this.l10n('select-all')}
            </button>
            <button
              type="button"
              @click=${this._handleDeselectAll}
              ?hidden=${!sel || sel.selectedCount !== sel.total}
            >
              ${this.l10n('deselect-all')}
            </button>
          </div>
          <button
            type="button"
            class="uc-done-btn uc-primary-btn"
            @click=${this._handleDone}
            ?disabled=${!ready || !sel?.selectedFiles.length}
            ?hidden=${!sel?.total}
          >
            <uc-spinner ?hidden=${ready}></uc-spinner>
            <span class=${ready ? '' : 'uc-hidden'}>${this.l10n('done')}</span>
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
