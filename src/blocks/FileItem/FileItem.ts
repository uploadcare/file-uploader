import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import { inject, injectOrNull } from '../../abstract/di/inject';
import { PluginController, type PluginFileActionRegistration } from '../../abstract/managers/plugin';
import type { Owned } from '../../abstract/managers/plugin/PluginTypes';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import type { UploadEntryData, UploadEntryKeys } from '../../abstract/uploadEntrySchema';
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

// The file-item display state machine. This — and everything derived from it
// (badge, flags, hint, progress, name, aria) — is UI/presentation logic and
// lives in the element; only file/upload/collection *side-effects* (aborting an
// upload, removing an entry, telemetry) belong in the controller layer.
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

// Entry keys the state-machine verdict (`_deriveState`) reads. A change to one of
// these is the only trigger for the imperative focus-clear side-effect
// (`_syncUploadingFocus`); everything else the state feeds — badge, flags, hint,
// progress, aria, name — is a pure `getTracked` read in `render()`, so Lit
// re-renders those on the exact keys read with no imperative mirror.
const STATE_KEYS: ReadonlySet<UploadEntryKeys> = new Set<UploadEntryKeys>([
  'errors',
  'isQueuedForUploading',
  'isQueuedForValidation',
  'isValidationPending',
  'isUploading',
  'fileInfo',
]);
// Entry keys whose change re-evaluates plugin file actions.
const PLUGIN_ACTION_KEYS: ReadonlySet<UploadEntryKeys> = new Set<UploadEntryKeys>([
  'fileInfo',
  'isUploading',
  'errors',
]);

export class FileItem extends FileItemConfig {
  // `ConfigController`/`TelemetryManager` are always-bound `@inject` fields.
  // `UploadCollectionController` and `UploaderPublicApi` are uploader-scope-bound
  // and read null-tolerantly (handlers can run outside an adopted scope / during
  // a teardown race), so they are `@injectOrNull` (`?.`-read); `PluginController`
  // is conditionally bound and wired via `whenController`.
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;
  @injectOrNull(UploadCollectionController) private readonly _collection!: UploadCollectionController | null;
  @injectOrNull(UploaderPublicApi) private readonly _api!: UploaderPublicApi | null;

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

  // UI focus flag (drives `[data-focused]`). Not entry-derived — set by the click
  // handler and cleared imperatively when the entry starts uploading.
  @state()
  private _isFocused = false;

  @state()
  private _pluginFileActions: Owned<PluginFileActionRegistration>[] = [];

  private _renderedOnce = false;
  private _observer?: IntersectionObserver;
  private _pluginManager: PluginController | null = null;

  // Thin UI handler: the file/upload side-effects live at the collection level —
  // `UploadCollectionController.remove` aborts the in-flight upload and emits the
  // removal telemetry. The element just requests the removal for its entry.
  private _handleRemove = (): void => {
    const collection = this._collection;
    if (this.uid && collection?.hasItem(this.uid)) {
      collection.remove(this.uid);
    }
  };

  // Single source of truth for the state-machine verdict. `read` is `getTracked`
  // in `render()` (so `SignalWatcher` re-renders on the exact keys read) and the
  // plain `get` in the imperative focus-sync path (no tracking off the render).
  private _deriveState(read: <K extends UploadEntryKeys>(key: K) => UploadEntryData[K]): FileItemStateValue {
    if (read('errors').length > 0) {
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
    if (read('isUploading')) {
      return FileItemState.UPLOADING;
    }
    if (read('fileInfo')) {
      return FileItemState.FINISHED;
    }
    return FileItemState.IDLE;
  }

  // The one genuine side-effect the entry state drives that is NOT pure render:
  // an item that starts uploading drops its focus. Reads imperatively (`get`), so
  // it never tracks off a render pass.
  private _syncUploadingFocus(): void {
    const entry = this.entry;
    if (!entry) {
      return;
    }
    if (this._deriveState((key) => entry.get(key)) === FileItemState.UPLOADING) {
      this._isFocused = false;
      this.removeAttribute('focused');
    }
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

    // The uploader-scope controllers exist only once an uploader block initializes this ctx.
    const entry = this._collection?.read(id) ?? null;
    this.entry = entry;

    if (!entry) {
      this._updatePluginFileActions();
      return;
    }

    // ONE keyed subscription drives only the genuine side-effects that are NOT
    // pure render: the focus-clear-on-uploading transition and the plugin
    // file-action recompute. Everything the row *displays* (name, badge, flags,
    // hint, progress, aria) is a `getTracked` read in `render()`, so Lit
    // re-renders on the exact entry keys it reads — no imperative mirror.
    this.subEntryKeys((key) => {
      if (STATE_KEYS.has(key)) {
        this._syncUploadingFocus();
      }
      if (PLUGIN_ACTION_KEYS.has(key)) {
        this._updatePluginFileActions();
      }
    });

    // Seed the initial side-effects (subscribeKeys does not replay current state).
    this._syncUploadingFocus();
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
    const api = this._api;
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

    const api = this._api;
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

  // Host `[mode]` attribute: the `uc-file-item[mode="grid"]` CSS selectors key off
  // it, driving the grid/list box sizing, so it must be set eagerly before first
  // paint. `beforeUpdate` fires this synchronously on adoption AND keeps firing on
  // `filesViewMode` change even while `_pauseRender` holds `shouldUpdate` off —
  // which a plain `willUpdate`+`getTracked` host-attr write could not do.
  @effect({ beforeUpdate: true })
  protected _applyMode(): void {
    this.setAttribute('mode', this._config.getTracked('filesViewMode'));
  }

  protected override controllerReady(): void {
    this._handleEntryId(this.uid);

    // Single-focus: unfocus the previously-focused item and focus this one — O(1)
    // per click. Replaces an O(N) sweep over every connected FileItem (which
    // mutated `[focused]` on all rows, dirtying style for the whole list at large
    // N) and the static `Set` of all instances (which pinned every row from GC).
    this.onclick = () => {
      const previous = FileItem._focusedInstance;
      if (previous && previous !== this) {
        previous.removeAttribute('focused');
      }
      this.setAttribute('focused', '');
      FileItem._focusedInstance = this;
    };
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
    // Release the static focus reference if it points at this row, so a removed/
    // re-adopted item isn't retained (and a later click doesn't touch a stale one).
    if (FileItem._focusedInstance === this) {
      FileItem._focusedInstance = null;
    }
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
  // The currently-focused item (single-focus model — see the click handler).
  private static _focusedInstance: FileItem | null = null;

  protected override shouldUpdate(changedProperties: PropertyValues<this>): boolean {
    if (this._pauseRender) {
      return false;
    }
    return super.shouldUpdate(changedProperties);
  }

  private get _state(): FileItemStateValue {
    const { entry } = this;
    return entry ? this._deriveState((key) => entry.getTracked(key)) : FileItemState.IDLE;
  }

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
    if (externalUrl && source && Object.values(ExternalUploadSource).includes(source)) {
      return this.l10n('waiting-for', { source: this.l10n(`src-type-${canonicalSourceName(source)}`) });
    }
    return '';
  }

  private get _ariaLabelStatusFile(): string {
    const fileName = this.entry?.getTracked('fileName') ?? null;
    if (!fileName) {
      return '';
    }
    return this.l10n('a11y-file-item-status', {
      fileName,
      status: this.l10n(this._state.description?.toLocaleLowerCase() ?? '').toLocaleLowerCase(),
    });
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

        <div
          aria-atomic="true"
          aria-live="polite"
          class="uc-file-name-wrapper"
          aria-label=${this._ariaLabelStatusFile}
        >
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
