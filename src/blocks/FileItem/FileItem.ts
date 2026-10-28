import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import { deriveEntryStatus } from '../../abstract/deriveEntryStatus';
import { inject } from '../../abstract/di/inject';
import { PluginController, type PluginFileActionRegistration } from '../../abstract/managers/plugin';
import { type Owned, pluginLabelKey } from '../../abstract/managers/plugin/PluginTypes';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import type { UploadEntryData, UploadEntryKeys } from '../../abstract/uploadEntrySchema';
import { isExternalSource, sourceLabelKey } from '../../utils/UploadSource';
import './file-item.css';
import type { Uid } from '../../abstract/Uid';
import { effect } from '../../lit/effect';
import { subscription, type Unsubscribe } from '../../lit/subscription';
import { FileItemConfig } from './FileItemConfig';

import '../Thumb/Thumb';
import '../Icon/Icon';
import '../ProgressBar/ProgressBar';
import './FileActionButton';

// The file-item display state machine. This — and everything derived from it
// (badge, flags, hint, progress, name, aria) — is UI/presentation logic and
// lives in the element; only file/upload/collection *side-effects* (aborting an
// upload, removing an entry, telemetry) belong in the controller layer.
// Each value is also the l10n key of the state's name in the row's aria label.
const FileItemState = Object.freeze({
  FINISHED: 'finished',
  FAILED: 'failed',
  UPLOADING: 'uploading',
  VALIDATION: 'validation',
  QUEUED_UPLOADING: 'queued-uploading',
  QUEUED_VALIDATION: 'queued-validation',
  IDLE: 'idle',
} as const);

type FileItemStateValue = (typeof FileItemState)[keyof typeof FileItemState];

// Entry keys whose change re-evaluates plugin file actions.
const PLUGIN_ACTION_KEYS: ReadonlySet<UploadEntryKeys> = new Set<UploadEntryKeys>([
  'fileInfo',
  'isUploading',
  'errors',
]);

export class FileItem extends FileItemConfig {
  // `@inject` fields, read only while adopted: from `controllerReady`, the
  // render-gated `willUpdate`, the rendered row's click handlers, and plugin-action
  // recomputes that bail once `controllerReleased` drops the plugin manager.
  // `PluginController` is conditionally bound and wired via `whenController`.
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;
  @inject(UploadCollectionController) private readonly _collection!: UploadCollectionController;
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;

  // Off-screen render gate. Complements list virtualization rather than being
  // superseded by it: virtualization caps mounted rows in the bounded/steady
  // case, but when the list can't be windowed yet — the first render of a large
  // bulk-populate (row geometry not measured) and unbounded/page-scroll
  // containers — the row still mounts, and this keeps that render CHEAP (empty)
  // until it scrolls into view. Without it, a bulk add renders every FileItem
  // template synchronously in one frame (Thumb's own lazy observer only defers
  // the thumbnail image, not the template), blocking the summary update.
  @state()
  private _pauseRender = true;

  @property({
    attribute: false,
  })
  public uid: Uid = '' as Uid;

  // Set by the parent `<uc-upload-list>`, which keeps one focused row per list.
  @property({ attribute: false })
  public focused = false;

  @state()
  private _pluginFileActions: Owned<PluginFileActionRegistration>[] = [];

  private _renderedOnce = false;
  private _observer?: IntersectionObserver;
  private _pluginManager: PluginController | null = null;

  private _handleRemove = (): void => {
    const collection = this._collection;
    if (!this.uid || !collection.hasItem(this.uid)) {
      return;
    }
    // Telemetry only for a real removal — guard first, so a stale/double
    // `uc:remove` (or an unset uid) doesn't record a phantom `remove-file`.
    this._telemetry.sendActionEvent('remove-file', this.tagName);
    // Aborting the in-flight upload is file/upload logic and lives in
    // `UploadCollectionController.remove` — the UI just requests the removal.
    collection.remove(this.uid);
  };

  // The state-machine verdict: the output status (`deriveEntryStatus`), with the queue and validation steps checked
  // after a failure and before the rest. `read` is `getTracked`, so `SignalWatcher` re-renders on the exact keys read.
  private _deriveState(read: <K extends UploadEntryKeys>(key: K) => UploadEntryData[K]): FileItemStateValue {
    const status = deriveEntryStatus({
      isRemoved: false,
      errors: read('errors'),
      fileInfo: read('fileInfo'),
      isUploading: read('isUploading'),
    });
    if (status === 'failed') {
      return FileItemState.FAILED;
    }
    if (read('isQueuedForUploading')) {
      return FileItemState.QUEUED_UPLOADING;
    }
    if (read('isQueuedForValidation')) {
      return FileItemState.QUEUED_VALIDATION;
    }
    if (read('isValidationPending')) {
      return FileItemState.VALIDATION;
    }
    if (status === 'success') {
      return FileItemState.FINISHED;
    }
    if (status === 'uploading') {
      return FileItemState.UPLOADING;
    }
    return FileItemState.IDLE;
  }

  private _observerCallback(entries: IntersectionObserverEntry[]): void {
    const [entry] = entries;
    if (!entry) {
      return;
    }

    if (entry.isIntersecting && !this._renderedOnce) {
      this._pauseRender = false;
      this._renderedOnce = true;
      // One-shot: the observer's only job is to un-pause on first view. Disconnect
      // so it stops firing on every subsequent scroll for this row's whole life
      // (matches Thumb).
      this._observer?.disconnect();
    }
  }

  private _handleEntryId(id: Uid): void {
    this.reset();

    const entry = this._collection.read(id) ?? null;
    this.entry = entry;

    if (!entry) {
      this._updatePluginFileActions();
      return;
    }

    // ONE keyed subscription drives the only side-effect that is NOT pure
    // render: the plugin file-action recompute. Everything the row *displays*
    // (name, badge, flags, hint, progress, aria) is a `getTracked` read in
    // `render()`, so Lit re-renders on the exact entry keys it reads.
    this.subEntryKeys((key) => {
      if (PLUGIN_ACTION_KEYS.has(key)) {
        this._updatePluginFileActions();
      }
    });

    // Seed the initial side-effect (subscribeKeys does not replay current state).
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
    // Derived once per update for the getters below; `getTracked` re-runs the update when a read key changes.
    const { entry } = this;
    this._state = entry ? this._deriveState((key) => entry.getTracked(key)) : FileItemState.IDLE;
  }

  private _updatePluginFileActions(): void {
    const pluginManager = this._pluginManager;
    // A row can briefly hold the uid of an entry that is gone — e.g. right after a remount into a fresh ctx, before the
    // list re-renders — and `getOutputItem` throws for those.
    if (!pluginManager || !this.uid || !this._collection.hasItem(this.uid)) {
      this._pluginFileActions = [];
      return;
    }

    const allFileActions = pluginManager.snapshot().fileActions;
    const outputFileEntry = this._api.getOutputItem(this.uid);

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

    const outputFileEntry = this._api.getOutputItem(this.uid);
    if (!outputFileEntry) {
      return;
    }

    this._telemetry.sendActionEvent(action.id, this.tagName, { pluginId: action.pluginId });

    this.runTask(async () => {
      try {
        await action.onClick(outputFileEntry);
      } catch (error) {
        this._log.error(`Error in plugin file action onClick (${action.id}):`, error);
      }
    });
  }

  // Host `[mode]` attribute: the `uc-file-item[mode="grid"]` CSS selectors key off
  // it, driving the grid/list box sizing, so it must be set eagerly before first
  // paint. `beforeUpdate` fires this synchronously on adoption AND keeps firing on
  // `filesViewMode` change even while `_pauseRender` holds `shouldUpdate` off —
  // which a plain `willUpdate`+`getTracked` host-attr write could not do.
  /** @internal */
  @effect({ beforeUpdate: true })
  protected _applyMode(): void {
    this.setAttribute('mode', this._config.getTracked('filesViewMode'));
  }

  protected override controllerReady(): void {
    this._handleEntryId(this.uid);
  }

  // The uploader-scope `PluginController` is bound + resolved only once an
  // uploader scope attaches (`ensurePluginManager`, conditional) — possibly after
  // adoption, or never in a bare ctx — so go through `whenController`; its
  // callback returns the plugin-change subscription, which the unsubscribe disposes.
  /** @internal */
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

    // One-shot render gate: un-pause on first view (see `_pauseRender`). The
    // observer watches this element's own node.
    this._observer = new window.IntersectionObserver(this._observerCallback.bind(this), {
      threshold: [0, 1],
    });
    this._observer.observe(this);
  }

  public override disconnectedCallback(): void {
    // `super.disconnectedCallback()` (via `_releaseController` / FileItemConfig)
    // drops membership and calls `reset()`; also tear down this element's own
    // IntersectionObserver.
    super.disconnectedCallback();
    this._observer?.disconnect();
  }

  // The upload mechanics (queue, beforeUpload chain, progress/abort, error
  // handling) live in the DOM-free UploadController. This block reflects the
  // resulting entry mutations through `getTracked` reads in `render()`
  // (state/badge/progress/…) plus the keyed side-effect subscription.

  protected override shouldUpdate(changedProperties: PropertyValues<this>): boolean {
    if (this._pauseRender) {
      return false;
    }
    return super.shouldUpdate(changedProperties);
  }

  private _state: FileItemStateValue = FileItemState.IDLE;

  private get _isFinished(): boolean {
    return this._state === FileItemState.FINISHED;
  }

  private get _isFailed(): boolean {
    return this._state === FileItemState.FAILED;
  }

  private get _isUploading(): boolean {
    return this._state === FileItemState.UPLOADING;
  }

  // Waiting in the upload queue (accepted, not yet uploading) — surfaced in the UI
  // as an indeterminate progress indicator so it's clear the file is queued.
  private get _isQueued(): boolean {
    return this._state === FileItemState.QUEUED_UPLOADING;
  }

  private get _hideRemoveAction(): boolean {
    const state = this._state;
    return state === FileItemState.QUEUED_UPLOADING || state === FileItemState.UPLOADING;
  }

  private get _badgeIcon(): string {
    const state = this._state;
    return state === FileItemState.FAILED ? 'badge-error' : state === FileItemState.FINISHED ? 'badge-success' : '';
  }

  private get _errorText(): string {
    return this.entry?.getTracked('errors')?.[0]?.message ?? '';
  }

  private get _progressValue(): number {
    const { entry } = this;
    if (!entry) {
      return 0;
    }
    const state = this._state;
    const isValidating = state === FileItemState.QUEUED_VALIDATION || state === FileItemState.VALIDATION;
    return isValidating ? 0 : entry.getTracked('uploadProgress');
  }

  private get _itemName(): string {
    const { entry } = this;
    if (!entry) {
      return '';
    }
    return entry.getTracked('fileName') || entry.getTracked('externalUrl') || this.l10n('file-no-name');
  }

  private get _hint(): string {
    const { entry } = this;
    if (!entry || this._errorText || this._isFinished) {
      return '';
    }
    const source = entry.getTracked('source');
    const externalUrl = entry.getTracked('externalUrl');
    if (externalUrl && source && isExternalSource(source)) {
      return this.l10n('waiting-for', { source: this.l10n(sourceLabelKey(source)) });
    }
    return '';
  }

  private get _statusText(): string {
    const fileName = this.entry?.getTracked('fileName') ?? null;
    if (!fileName) {
      return '';
    }
    return this.l10n('a11y-file-item-status', {
      fileName,
      status: this.l10n(this._state).toLocaleLowerCase(),
    });
  }

  public override render() {
    return html`
      <div
        class="uc-inner"
        ?data-finished=${this._isFinished}
        ?data-uploading=${this._isUploading}
        ?data-failed=${this._isFailed}
        ?data-focused=${this.focused && !this._isUploading}
      >
        <uc-thumb .uid=${this.uid} .badgeIcon=${this._badgeIcon}></uc-thumb>

        <div class="uc-file-name-wrapper" role="group" aria-label=${this._statusText}>
          <span class="uc-file-name" data-testid="file-name" ?hidden=${!this._showFileNames}>${this._itemName}</span>
          <span class="uc-file-error" ?hidden=${!this._errorText}>${this._errorText}</span>
          <span class="uc-file-hint" ?hidden=${!this._hint}>${this._hint}</span>
        </div>
        <div class="uc-file-actions">
          ${this._pluginFileActions.map(
            (action) => html`
              <button
                type="button"
                @click=${() => this._handlePluginFileAction(action)}
                title=${this.l10n(pluginLabelKey(action.label))}
                aria-label=${this.l10n(pluginLabelKey(action.label))}
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
            .queued=${this._isQueued}
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
