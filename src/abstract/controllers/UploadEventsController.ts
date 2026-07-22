import { debounce } from '../../utils/debounce';
import { applyInitialCrop } from '../applyInitialCrop';
import { containerOf } from '../di/ControllerContainer';
import { inject } from '../di/inject';
import { PluginController } from '../managers/plugin';
import { TypedData } from '../TypedData';
import type { UploadEntryData } from '../uploadEntrySchema';
import { ConfigController } from './ConfigController';
import type { CollectionObserver, UploadCollectionChangeMap } from './UploadCollectionController';
import { UploadCollectionController } from './UploadCollectionController';
import { UploadCollectionEventsController } from './UploadCollectionEventsController';
import { UploadFileEventsController } from './UploadFileEventsController';
import { UploadGroupController } from './UploadGroupController';
import { ValidationController } from './ValidationController';

type Unsubscribe = () => void;
type Entry = TypedData<UploadEntryData>;

const VALIDATION_TRIGGER_KEYS: (keyof UploadEntryData)[] = [
  'file',
  'uploadError',
  'fileInfo',
  'cdnUrl',
  'cdnUrlModifiers',
];

/**
 * The entry keys this controller must react to in
 * `_handleCollectionPropertiesUpdate`. This is NOT just the keys it reads off the
 * change-map (`uploadProgress`/`isUploading`/`fileInfo`/`errors`/`cdnUrl` for the
 * per-key emits, plus {@link VALIDATION_TRIGGER_KEYS} for validation) — the
 * handler ALSO calls `_flushOutputItems()` unconditionally on every fire, and
 * that recomputes `getOutputCollectionState` + emits the documented `change`
 * event. So the set must cover every key that can change the output — matching
 * the old global `UPLOAD_WATCH_LIST` exactly, including `isValidationPending`
 * (validation-state transitions change the output/counts) — PLUS `cdnUrlModifiers`
 * (a `VALIDATION_TRIGGER_KEY` the old list wrongly omitted, so editor-applied
 * modifiers never re-validated or fired `change`). Declaring it here (demand-
 * driven) is what lets the collection drop the hardcoded constant.
 */
const PROPERTY_OBSERVE_KEYS: (keyof UploadEntryData)[] = [
  'file',
  'uploadProgress',
  'uploadError',
  'fileInfo',
  'errors',
  'cdnUrl',
  'cdnUrlModifiers',
  'isUploading',
  'isValidationPending',
];

/**
 * DOM-free upload-events engine — the collection→events derivation that v1 ran
 * inline in `LitUploaderBlock`.
 *
 * This is a thin COORDINATOR: it owns the collection observers + the active/
 * teardown lifecycle and dispatches, in the exact order the observers dictate, to
 * focused collaborators that own the actual side-effects:
 * - {@link UploadFileEventsController} — per-file events (added/removed/progress/
 *   start/success/failed/url-changed) + per-entry finalization.
 * - {@link UploadCollectionEventsController} — collection-level derived state
 *   (`uploadList`/`collectionState`/`commonProgress`/`groupInfo`) + collection
 *   events (`CHANGE`/`COMMON_UPLOAD_*`).
 * - {@link UploadGroupController} — output-group creation (`GROUP_CREATED`).
 *
 * Validation orchestration stays with {@link ValidationController}; plugin `onAdd`
 * hooks fire through the conditionally-bound {@link PluginController} via the
 * container (`containerOf` + `whenController`, now-or-when-available). Everything
 * is container-resolved and runs without a DOM. `observe()` is called by
 * `registerUploadStack` once the whole stack is resolved.
 */
export class UploadEventsController {
  @inject(UploadCollectionController) private readonly _collection!: UploadCollectionController;
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(ValidationController) private readonly _validation!: ValidationController;
  @inject(UploadFileEventsController) private readonly _fileEvents!: UploadFileEventsController;
  @inject(UploadCollectionEventsController) private readonly _collectionEvents!: UploadCollectionEventsController;
  @inject(UploadGroupController) private readonly _group!: UploadGroupController;

  // Active while observing (the v1 `isConnected` guard) — survives disconnect/
  // reconnect cycles; gates the debounced flush + deferred validation/group that
  // may fire after the host disconnects.
  private _active = false;
  private _unobserveCollection?: Unsubscribe;
  private _unobserveProperties?: Unsubscribe;

  /** Apply the `cropPreset` to freshly-uploaded images (was a host-injected callback). */
  private _applyInitialCrop(): void {
    applyInitialCrop(this._collection, this._config.get('cropPreset'));
  }

  /** Start observing the collection. Idempotent. */
  public observe(): void {
    this.unobserve();
    this._active = true;
    this._unobserveCollection = this._collection.observeCollection(this._handleCollectionUpdate);
    this._unobserveProperties = this._collection.observeProperties(
      PROPERTY_OBSERVE_KEYS,
      this._handleCollectionPropertiesUpdate,
    );
  }

  public unobserve(): void {
    this._active = false;
    this._unobserveProperties?.();
    this._unobserveCollection?.();
    this._unobserveProperties = undefined;
    this._unobserveCollection = undefined;
    this._flushOutputItems.cancel();
  }

  /** Final teardown — alias for {@link unobserve}. */
  public destroy(): void {
    this.unobserve();
  }

  // Plugin `onAdd` hooks live on the conditionally-bound `PluginController` (bound
  // by `ensurePluginManager`); fire now-or-when-available via the container. It is
  // bound at scope-attach (before any file is added), so this normally fires
  // synchronously; the `_active` re-check guards the rare deferred case where the
  // manager resolves only after `unobserve()`, so a stale waiter can't run hooks
  // against a released scope.
  private _runPluginOnAdd(entry: Entry): void {
    containerOf(this)?.whenController(PluginController, (pluginManager) => {
      if (!this._active) return;
      pluginManager.runOnAddHooks(entry);
    });
  }

  private _handleCollectionUpdate: CollectionObserver = (entries, added, removed) => {
    if (!this._active) return;

    this._collectionEvents.resetGroupIfMembershipChanged(added, removed);

    this._validation.runFileValidators(
      'add',
      [...added].map((e) => e.uid),
    );

    for (const entry of added) {
      this._fileEvents.added(entry);
      this._runPluginOnAdd(entry);
    }

    this._validation.runCollectionValidators();

    for (const entry of removed) {
      // The in-flight upload is already aborted by `UploadCollectionController.remove`
      // (the single owner of that side-effect); here we only clear validation +
      // entry state and emit `FILE_REMOVED`.
      this._validation.cleanupValidationForEntry(entry);
      this._fileEvents.finalizeRemoved(entry);
    }

    this._collectionEvents.setUploadList(entries);
    this._collectionEvents.flushCommonProgress();
    this._flushOutputItems();
  };

  private _handleCollectionPropertiesUpdate = (changeMap: UploadCollectionChangeMap): void => {
    if (!this._active) return;

    this._flushOutputItems();
    this._scheduleValidation(changeMap);

    if (changeMap.uploadProgress) {
      this._fileEvents.progress(changeMap.uploadProgress);
      this._collectionEvents.flushCommonProgress();
    }
    if (changeMap.isUploading) {
      this._fileEvents.start(changeMap.isUploading);
    }
    if (changeMap.fileInfo) {
      this._fileEvents.success(changeMap.fileInfo);
      if (this._config.get('cropPreset')) {
        this._applyInitialCrop();
      }
    }
    if (changeMap.errors) {
      this._validation.runCollectionValidators();
      for (const entryId of changeMap.errors) {
        // Pair each per-file failure with a (debounced) common-failed emit, matching
        // the original per-entry interleave.
        if (this._fileEvents.failed(entryId)) {
          this._collectionEvents.emitCommonFailed();
        }
      }
      this._collectionEvents.emitCommonSuccessIfComplete();
    }
    if (changeMap.cdnUrl) {
      this._fileEvents.urlChanged(changeMap.cdnUrl);
      this._collectionEvents.resetGroup();
    }
  };

  // Deferred file validation for the keys that trigger it — a tick later, since we
  // can't mutate entry properties in the same tick. Guards `_active` (a released
  // scope must not run validators).
  private _scheduleValidation(changeMap: UploadCollectionChangeMap): void {
    const entriesToRunValidation = [
      ...new Set(
        Object.entries(changeMap)
          .filter(([key]) => VALIDATION_TRIGGER_KEYS.includes(key as keyof UploadEntryData))
          .flatMap(([, ids]) => [...(ids ?? [])]),
      ),
    ];
    if (entriesToRunValidation.length === 0) return;
    setTimeout(() => {
      if (!this._active) return;
      const entriesToRunOnUpload = entriesToRunValidation.filter(
        (entryId) =>
          changeMap.fileInfo?.has(entryId) && !!TypedData.getByUid<UploadEntryData>(entryId)?.values.fileInfo,
      );
      if (entriesToRunOnUpload.length > 0) {
        this._validation.runFileValidators('upload', entriesToRunOnUpload);
      }
      this._validation.runFileValidators('change', entriesToRunValidation);
    });
  }

  // Debounced: publish the derived collection state + `CHANGE`, then create the
  // output group when configured and fully successful. Cancelled on `unobserve()`.
  private _flushOutputItems = debounce(() => {
    const collectionState = this._collectionEvents.flushOutput();
    if (
      collectionState &&
      this._config.get('groupOutput') &&
      collectionState.totalCount > 0 &&
      collectionState.status === 'success'
    ) {
      void this._group.create(collectionState, () => this._active);
    }
  }, 300);
}
