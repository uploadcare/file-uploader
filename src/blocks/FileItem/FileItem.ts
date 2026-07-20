import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { CollectionStateController } from '../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import { UploadController } from '../../abstract/controllers/UploadController';
import { inject } from '../../abstract/di/inject';
import { PluginController, type PluginFileActionRegistration } from '../../abstract/managers/plugin';
import type { Owned } from '../../abstract/managers/plugin/PluginTypes';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import type { UploadEntryTypedData } from '../../abstract/uploadEntrySchema';
import { debounce } from '../../utils/debounce';
import { throttle } from '../../utils/throttle';
import { canonicalSourceName, ExternalUploadSource } from '../../utils/UploadSource';
import './file-item.css';
import { effect } from '../../lit/effect';
import { subscription, type Unsubscribe } from '../../lit/subscription';
import type { Uid } from '../../lit/Uid';
import { FileItemConfig } from './FileItemConfig';

import '../Thumb/Thumb';
import '../Icon/Icon';
import '../ProgressBar/ProgressBar';
import './FileActionButton';

const FileItemState = Object.freeze({
  FINISHED: Symbol('FINISHED'),
  FAILED: Symbol('FAILED'),
  UPLOADING: Symbol('UPLOADING'),
  VALIDATION: Symbol('VALIDATION'),
  QUEUED_UPLOADING: Symbol('QUEUED-UPLOADING'),
  QUEUED_VALIDATION: Symbol('QUEUED-VALIDATION'),
  IDLE: Symbol('IDLE'),
} as const);

type FileItemStateValue = (typeof FileItemState)[keyof typeof FileItemState];

export class FileItem extends FileItemConfig {
  // Always-bound controllers become `@inject` fields. `UploadCollectionController`
  // and `UploaderPublicApi` are uploader-scope-bound and read null-tolerantly via
  // `useOrNull` (handlers can run outside an adopted scope / during a teardown
  // race); `PluginController` is conditionally bound and read via `whenController`;
  // the upload stack's `UploadController` is a bound host-boundary token read via
  // `use()` from the post-adoption upload trigger — all stay off `@inject`.
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;

  @state()
  private _pauseRender = true;

  @property({
    attribute: false,
  })
  public uid: Uid = '' as Uid;

  @state()
  private _itemName = '';

  @state()
  private _errorText = '';

  @state()
  private _hint = '';

  @state()
  private _progressValue = 0;

  @state()
  private _badgeIcon = '';

  @state()
  private _isFinished = false;

  @state()
  private _isFailed = false;

  @state()
  private _isUploading = false;

  @state()
  private _hideRemoveAction = false;

  @state()
  private _isFocused = false;

  @state()
  private _ariaLabelStatusFile = '';

  @state()
  private _pluginFileActions: Owned<PluginFileActionRegistration>[] = [];

  private _renderedOnce = false;
  private _observer?: IntersectionObserver;
  private _pluginManager: PluginController | null = null;

  private _handleRemove = (): void => {
    this._telemetry.sendEvent({
      payload: {
        metadata: {
          event: 'remove-file',
          node: this.tagName,
        },
      },
    });

    // `uploadCollection` is container-owned (M-god step 4). Read it
    // null-tolerantly via `useOrNull`: this handler can run outside an adopted
    // scope (teardown race), where the throwing `use()` would be unsafe.
    const collection = this.useOrNull(UploadCollectionController);
    if (this.uid && collection?.hasItem(this.uid)) {
      this.entry?.getValue('abortController')?.abort();
      collection.remove(this.uid);
    }
  };

  private _calculateState(): void {
    const entry = this.entry;
    if (!entry) {
      return;
    }

    let state: FileItemStateValue = FileItemState.IDLE;

    if (entry.getValue('errors').length > 0) {
      state = FileItemState.FAILED;
    } else if (entry.getValue('isQueuedForUploading')) {
      state = FileItemState.QUEUED_UPLOADING;
    } else if (entry.getValue('isQueuedForValidation')) {
      state = FileItemState.QUEUED_VALIDATION;
    } else if (entry.getValue('isValidationPending')) {
      state = FileItemState.VALIDATION;
    } else if (entry.getValue('isUploading')) {
      state = FileItemState.UPLOADING;
    } else if (entry.getValue('fileInfo')) {
      state = FileItemState.FINISHED;
    }

    this._handleState(entry, state);
  }

  private _debouncedCalculateState = debounce(() => this._calculateState(), 100);

  private _updateHintAndProgress = this.withEntry(
    throttle((entry: UploadEntryTypedData, state?: FileItemStateValue) => {
      // A trailing throttle tick can fire after the item unmounts / its container
      // is released (an entry update that raced teardown). The `l10n` reads below
      // go through `use()`, which throws once the container is gone — bail first.
      if (!this.containerOrNull) {
        return;
      }
      const errorText = entry.getValue('errors')?.[0]?.message ?? '';
      const source = entry.getValue('source');
      const externalUrl = entry.getValue('externalUrl');
      const isFinished = state === FileItemState.FINISHED;
      const isQueuedForValidation = state === FileItemState.QUEUED_VALIDATION;
      const isValidationPending = state === FileItemState.VALIDATION;
      const fileName = entry.getValue('fileName');
      let hint = '';

      if (errorText) {
        hint = '';
      } else if (!isFinished && externalUrl && source && Object.values(ExternalUploadSource).includes(source)) {
        hint = this.l10n('waiting-for', { source: this.l10n(`src-type-${canonicalSourceName(source)}`) });
      }

      this._hint = hint;
      this._errorText = errorText;
      this._progressValue = isQueuedForValidation || isValidationPending ? 0 : entry.getValue('uploadProgress');
      this._ariaLabelStatusFile = fileName
        ? this.l10n('a11y-file-item-status', {
            fileName,
            status: this.l10n(state?.description?.toLocaleLowerCase() ?? '').toLocaleLowerCase(),
          })
        : '';
    }, 100),
  );

  private _handleState(_entry: UploadEntryTypedData, state: FileItemStateValue): void {
    if (state === FileItemState.FAILED) {
      this._badgeIcon = 'badge-error';
    } else if (state === FileItemState.FINISHED) {
      this._badgeIcon = 'badge-success';
    }

    if (state === FileItemState.UPLOADING) {
      this._isFocused = false;
      this.removeAttribute('focused');
    }

    this._isFailed = state === FileItemState.FAILED;
    this._isUploading = state === FileItemState.UPLOADING;
    this._hideRemoveAction = state === FileItemState.QUEUED_UPLOADING || state === FileItemState.UPLOADING;
    this._isFinished = state === FileItemState.FINISHED;

    this._updateHintAndProgress(state);
  }

  protected override reset(): void {
    super.reset();
    this._debouncedCalculateState.cancel();
  }

  private _observerCallback(entries: IntersectionObserverEntry[]): void {
    const [entry] = entries;
    if (!entry) {
      return;
    }

    if (entry.isIntersecting && !this._renderedOnce) {
      this._pauseRender = false;
      this._renderedOnce = true;
    }
  }

  private _handleEntryId(id: Uid): void {
    this.reset();

    // The uploader-scope controllers exist only once an uploader block initializes this ctx.
    const entry = this.useOrNull(UploadCollectionController)?.read(id) ?? null;
    this.entry = entry;

    if (!entry) {
      this._updatePluginFileActions();
      return;
    }

    this.subEntry('isQueuedForValidation', () => {
      this._debouncedCalculateState();
    });

    this.subEntry('isValidationPending', () => {
      this._debouncedCalculateState();
    });

    this.subEntry('uploadProgress', () => {
      this._debouncedCalculateState();
    });

    this.subEntry('isQueuedForUploading', () => {
      this._debouncedCalculateState();
    });

    this.subEntry('fileName', (name) => {
      this._itemName = name || entry.getValue('externalUrl') || this.l10n('file-no-name');
      this._debouncedCalculateState();
    });

    this.subEntry('externalUrl', (externalUrl) => {
      this._itemName = entry.getValue('fileName') || externalUrl || this.l10n('file-no-name');
    });

    this.subEntry('fileInfo', () => {
      this._debouncedCalculateState();
    });

    this.subEntry('errors', () => this._debouncedCalculateState());
    this.subEntry('isUploading', () => this._debouncedCalculateState());
    this.subEntry('fileSize', () => this._debouncedCalculateState());
    this.subEntry('mimeType', () => this._debouncedCalculateState());
    this.subEntry('isImage', () => this._debouncedCalculateState());

    // Update plugin file actions when file status changes
    this.subEntry('fileInfo', () => this._updatePluginFileActions());
    this.subEntry('isUploading', () => this._updatePluginFileActions());
    this.subEntry('errors', () => this._updatePluginFileActions());

    this._calculateState();
    this._updatePluginFileActions();
  }

  /**
   * Whether file names are shown: always in list mode, otherwise driven by
   * `gridShowFileNames`. Tracked getter (drops the v1 `@state _showFileNames`,
   * `_updateShowFileNames`, and the `subConfigValue('gridShowFileNames')` mirror):
   * reading both keys via `getTracked` in `render()` auto-tracks them under
   * `SignalWatcher`, so a config change re-renders — same reactivity as the v1
   * subscription.
   */
  private get _showFileNames(): boolean {
    const config = this._config;
    return config.getTracked('filesViewMode') === 'list' ? true : config.getTracked('gridShowFileNames');
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has('uid')) {
      this._handleEntryId(this.uid);
    }
  }

  private _updatePluginFileActions(): void {
    const pluginManager = this._pluginManager;
    if (!pluginManager || !this.uid) {
      this._pluginFileActions = [];
      return;
    }

    // The uploader-scope controllers exist only once an uploader block initializes this ctx.
    const api = this.useOrNull(UploaderPublicApi);
    if (!api) {
      this._pluginFileActions = [];
      return;
    }

    const allFileActions = pluginManager.snapshot().fileActions;
    const outputFileEntry = api.getOutputItem(this.uid);

    if (!outputFileEntry) {
      this._pluginFileActions = [];
      return;
    }

    this._pluginFileActions = allFileActions.filter((action) => {
      try {
        return action.shouldRender(outputFileEntry);
      } catch (error) {
        this._log.error(`Error in plugin file action shouldRender (${action.id}):`, error);
        return false;
      }
    });
  }

  private _handlePluginFileAction(action: Owned<PluginFileActionRegistration>): void {
    if (!this.uid) {
      return;
    }

    const api = this.useOrNull(UploaderPublicApi);
    if (!api) {
      return;
    }

    const outputFileEntry = api.getOutputItem(this.uid);
    if (!outputFileEntry) {
      return;
    }

    this._telemetry.sendEvent({
      payload: {
        metadata: {
          event: action.id,
          node: this.tagName,
          pluginId: action.pluginId,
        },
      },
    });

    try {
      action.onClick(outputFileEntry);
    } catch (error) {
      this._log.error(`Error in plugin file action onClick (${action.id}):`, error);
    }
  }

  // Host `[mode]` attribute: the `uc-file-item[mode="grid"]` CSS selectors key
  // off it, driving the grid/list box sizing, so it must be set eagerly before
  // first paint. `beforeUpdate` fires this synchronously on adoption AND keeps
  // firing on `filesViewMode` change even while this block's `_pauseRender`
  // lazy-render gate holds `shouldUpdate` off (verified in effect.integration.test)
  // — which a plain `willUpdate`+`getTracked` host-attr write could not do.
  @effect({ beforeUpdate: true })
  protected _applyMode(): void {
    this.setAttribute('mode', this._config.getTracked('filesViewMode'));
  }

  protected override controllerReady(): void {
    this._handleEntryId(this.uid);

    this.onclick = () => {
      FileItem.activeInstances.forEach((inst) => {
        if (inst === this) {
          inst.setAttribute('focused', '');
        } else {
          inst.removeAttribute('focused');
        }
      });
    };

    FileItem.activeInstances.add(this);
  }

  // Side effect (fires `_upload`, not a render read): `uploadTrigger` (owned by
  // `CollectionStateController`) is a `Set` the writer REPLACES, so its atomic
  // `observe` (Object.is dedup) fires only on a real trigger, not on unrelated
  // collection-state writes; the eager pass covers a trigger set before adoption.
  @subscription()
  protected _wireUploadTrigger(): Unsubscribe {
    return this._collectionState.observe(
      'uploadTrigger',
      (itemsToUpload) => {
        if (this.entry && !itemsToUpload.has(this.entry.uid)) {
          return;
        }
        setTimeout(() => this.isConnected && this._upload());
      },
      { immediate: true },
    );
  }

  // The uploader-scope `PluginController` is bound + resolved only once an
  // uploader scope attaches (`ensurePluginManager`, conditional) — possibly after
  // adoption, or never in a bare ctx — so go through `whenController`; its
  // callback returns the plugin-change subscription, which the unsubscribe disposes.
  @subscription()
  protected _wirePluginFileActions(): Unsubscribe {
    return this.container.whenController(PluginController, (pm) => {
      this._pluginManager = pm;
      this._updatePluginFileActions();
      return pm.onPluginsChange(() => this._updatePluginFileActions());
    });
  }

  protected override controllerReleased(): void {
    this._pluginManager = null;
  }

  public override connectedCallback(): void {
    super.connectedCallback();

    this._observer = new window.IntersectionObserver(this._observerCallback.bind(this), {
      threshold: [0, 1],
    });
    this._observer.observe(this);
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();

    this._observer?.disconnect();

    FileItem.activeInstances.delete(this);

    this.reset();
  }

  // The upload mechanics (queue, beforeUpload chain, progress/abort, error
  // handling) now live in the DOM-free UploadController. This block stays the
  // trigger; it reacts to the resulting entry mutations through its existing
  // per-entry subscriptions (`isUploading`/`errors`/… → `_debouncedCalculateState`).
  private _upload = this.withEntry(async (entry) => {
    await this.use(UploadController).uploadEntry(entry.uid);
  });

  public static activeInstances: Set<FileItem> = new Set<FileItem>();

  protected override shouldUpdate(changedProperties: PropertyValues<this>): boolean {
    if (this._pauseRender) {
      return false;
    }
    return super.shouldUpdate(changedProperties);
  }

  public override render() {
    return html`
      <div
        class="uc-inner"
        ?data-finished=${this._isFinished}
        ?data-uploading=${this._isUploading}
        ?data-failed=${this._isFailed}
        ?data-focused=${this._isFocused}
      >
        <uc-thumb .uid=${this.uid} .badgeIcon=${this._badgeIcon}></uc-thumb>

        <div aria-atomic="true" aria-live="polite" class="uc-file-name-wrapper" aria-label=${this._ariaLabelStatusFile}>
          <span class="uc-file-name" ?hidden=${!this._showFileNames}>${this._itemName}</span>
          <span class="uc-file-error" ?hidden=${!this._errorText}>${this._errorText}</span>
          <span class="uc-file-hint" ?hidden=${!this._hint}>${this._hint}</span>
        </div>
        <div class="uc-file-actions">
          ${this._pluginFileActions.map(
            (action) => html`
              <button
                type="button"
                @click=${() => this._handlePluginFileAction(action)}
                title=${this.l10n(action.label)}
                aria-label=${this.l10n(action.label)}
                class="uc-plugin-action-btn uc-mini-btn"
                data-plugin-action-id=${action.id}
              >
                <uc-icon name=${action.icon}></uc-icon>
              </button>
            `,
          )}
          <uc-file-action-button
            @uc:remove=${this._handleRemove}
            .uploading=${this._isUploading}
            .hideRemove=${this._hideRemoveAction}
            .progress=${this._progressValue}
            .failed=${this._isFailed}
            .success=${this._isFinished}
          ></uc-file-action-button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-file-item': FileItem;
  }
}
