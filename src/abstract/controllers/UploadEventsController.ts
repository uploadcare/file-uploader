import { uploadFileGroup } from '@uploadcare/upload-client';
import { EventEmitter } from '../../blocks/UploadCtxProvider/EventEmitter';
import type { OutputCollectionState } from '../../types';
import { debounce } from '../../utils/debounce';
import { applyInitialCrop } from '../applyInitialCrop';
import { containerOf } from '../di/ControllerContainer';
import { inject, injectOrNull } from '../di/inject';
import { UploaderEventType } from '../EventBus';
import { PluginController } from '../managers/plugin';
import { TypedData } from '../TypedData';
import { UploaderPublicApi } from '../UploaderPublicApi';
import type { UploadEntryData } from '../uploadEntrySchema';
import { CollectionStateController } from './CollectionStateController';
import { ConfigController } from './ConfigController';
import type { CollectionObserver, UploadCollectionChangeMap } from './UploadCollectionController';
import { UploadCollectionController } from './UploadCollectionController';
import { UploadController } from './UploadController';
import { ValidationController } from './ValidationController';

type Unsubscribe = () => void;

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
 * inline in `LitUploaderBlock` (`_handleCollectionUpdate` /
 * `_handleCollectionPropertiesUpdate` / `_flushOutputItems` /
 * `_flushCommonUploadProgress` / `_createGroup`).
 *
 * It observes the upload collection and, as entries are added/removed and their
 * properties change, drives validation, emits the documented events (via the
 * host `emit`, a pure event dispatch that reaches the EventBus; telemetry
 * observes that bus independently, not this call), maintains the derived
 * `uploadList`/`collectionState`/`commonProgress`/`groupInfo` collection state
 * (owned by `CollectionStateController`), and creates the output group.
 *
 * Container-resolved (M-god step 5): controller peers (collection, config,
 * validation, upload, collection-state), the public API (output-state readers)
 * and the per-ctx `EventEmitter` are `@inject`-ed; plugin `onAdd` hooks fire
 * through the conditionally-bound `PluginController` via the container
 * (`containerOf` + `whenController`, now-or-when-available). So it runs zero-arg
 * without a DOM and is unit-testable. `observe()` is called explicitly by
 * `registerUploadStack` once the whole stack is resolved.
 */
export class UploadEventsController {
  @inject(UploadCollectionController) private readonly _collection!: UploadCollectionController;
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(ValidationController) private readonly _validation!: ValidationController;
  @inject(UploadController) private readonly _upload!: UploadController;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;
  // `@injectOrNull`: a teardown-time emit (released container) resolves `null` →
  // no-op, matching the guard the removed host `emit` closure carried.
  @injectOrNull(EventEmitter) private readonly _eventEmitter!: EventEmitter | null;

  // Guarded event dispatch — the direct successor to the host `emit` closure
  // (`ChildBlock.emit`): pure per-ctx `EventEmitter` dispatch that reaches the
  // bus (telemetry observes the bus independently; the DOM `CustomEvent` re-
  // dispatch is the provider's `_bridgeBusToDom` bus subscription, unaffected).
  // A bound arrow field so the handlers can keep destructuring `emit`;
  // rest-forwarded so the call arity (2- vs 3-arg) reaches `EventEmitter.emit`
  // unchanged rather than padding a trailing `undefined`.
  private _emit = (...args: Parameters<EventEmitter['emit']>): void => {
    this._eventEmitter?.emit(...args);
  };

  // Active while observing (the v1 `isConnected` guard) — survives disconnect/
  // reconnect cycles; gates the debounced flush + deferred validation that may
  // fire after the host disconnects.
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

  private _handleCollectionUpdate: CollectionObserver = (entries, added, removed) => {
    if (!this._active) return;
    const emit = this._emit;
    const getOutputItem = this._api.getOutputItem.bind(this._api);

    if (added.size || removed.size) {
      this._collectionState.set('groupInfo', null);
    }

    this._validation.runFileValidators(
      'add',
      [...added].map((e) => e.uid),
    );

    for (const entry of added) {
      if (!entry.get('silent')) {
        emit(UploaderEventType.FILE_ADDED, getOutputItem(entry.uid));
      }
      // Plugin `onAdd` hooks live on the conditionally-bound `PluginController`
      // (bound by `ensurePluginManager`); fire now-or-when-available via the
      // container, matching the removed bridge's `whenController` port of v1's
      // `bag.wait('pluginManager').then(…)`. `PluginController` is bound at
      // scope-attach (before any file is added), so this normally fires
      // synchronously; the `_active` re-check guards the rare deferred case where
      // the manager resolves only after `unobserve()`/`destroy()`, so a stale
      // waiter can't run `onAdd` hooks against a released scope.
      containerOf(this)?.whenController(PluginController, (pluginManager) => {
        if (!this._active) return;
        pluginManager.runOnAddHooks(entry);
      });
    }

    this._validation.runCollectionValidators();

    for (const entry of removed) {
      // (`UploadController` drops removed uids from its own active batch.) The
      // in-flight upload is already aborted by `UploadCollectionController.remove`
      // (the single owner of that side-effect), so this handler only clears state.
      this._validation.cleanupValidationForEntry(entry);
      entry.setMany({
        isRemoved: true,
        abortController: null,
        isUploading: false,
        uploadProgress: 0,
      });
      const thumbUrl = entry.get('thumbUrl');
      thumbUrl && URL.revokeObjectURL(thumbUrl);
      emit(UploaderEventType.FILE_REMOVED, getOutputItem(entry.uid));
    }

    this._collectionState.set(
      'uploadList',
      entries.map((uid) => ({ uid })),
    );

    this._flushCommonUploadProgress();
    this._flushOutputItems();
  };

  private _handleCollectionPropertiesUpdate = (changeMap: UploadCollectionChangeMap): void => {
    if (!this._active) return;
    const collection = this._collection;
    const config = this._config;
    const validation = this._validation;
    const emit = this._emit;
    const getOutputItem = this._api.getOutputItem.bind(this._api);
    const getOutputCollectionState = this._api.getOutputCollectionState.bind(this._api);

    this._flushOutputItems();

    const entriesToRunValidation = [
      ...new Set(
        Object.entries(changeMap)
          .filter(([key]) => VALIDATION_TRIGGER_KEYS.includes(key as keyof UploadEntryData))
          .flatMap(([, ids]) => [...(ids ?? [])]),
      ),
    ];

    entriesToRunValidation.length > 0 &&
      setTimeout(() => {
        if (!this._active) return;
        // We can't modify entry properties in the same tick, so we need to wait a bit
        const entriesToRunOnUpload = entriesToRunValidation.filter(
          (entryId) =>
            changeMap.fileInfo?.has(entryId) && !!TypedData.getByUid<UploadEntryData>(entryId)?.values.fileInfo,
        );
        if (entriesToRunOnUpload.length > 0) {
          validation.runFileValidators('upload', entriesToRunOnUpload);
        }
        validation.runFileValidators('change', entriesToRunValidation);
      });

    if (changeMap.uploadProgress) {
      for (const entryId of changeMap.uploadProgress) {
        const entry = TypedData.getByUid<UploadEntryData>(entryId);
        if (!entry) continue;
        const { isUploading, silent } = entry.values;
        if (isUploading && !silent) {
          emit(UploaderEventType.FILE_UPLOAD_PROGRESS, getOutputItem(entryId));
        }
      }

      this._flushCommonUploadProgress();
    }
    if (changeMap.isUploading) {
      for (const entryId of changeMap.isUploading) {
        const entry = TypedData.getByUid<UploadEntryData>(entryId);
        if (!entry) continue;
        const { isUploading, silent } = entry.values;
        if (isUploading && !silent) {
          emit(UploaderEventType.FILE_UPLOAD_START, getOutputItem(entryId));
        }
      }
    }
    if (changeMap.fileInfo) {
      for (const entryId of changeMap.fileInfo) {
        const entry = TypedData.getByUid<UploadEntryData>(entryId);
        if (!entry) continue;
        const { fileInfo, silent } = entry.values;
        if (fileInfo && !silent) {
          emit(UploaderEventType.FILE_UPLOAD_SUCCESS, getOutputItem(entryId));
        }
      }
      if (config.get('cropPreset')) {
        this._applyInitialCrop();
      }
    }
    if (changeMap.errors) {
      validation.runCollectionValidators();

      for (const entryId of changeMap.errors) {
        const entry = TypedData.getByUid<UploadEntryData>(entryId);
        if (!entry) continue;
        const { errors } = entry.values;
        if (errors.length > 0) {
          emit(UploaderEventType.FILE_UPLOAD_FAILED, getOutputItem(entryId));
          emit(
            UploaderEventType.COMMON_UPLOAD_FAILED,
            () => getOutputCollectionState() as OutputCollectionState<'failed'>,
            { debounce: true },
          );
        }
      }
      // One pass instead of two `findItems` scans: "all loaded, none errored".
      let loadedCount = 0;
      let hasErrored = false;
      for (const uid of collection.items()) {
        const entry = collection.read(uid);
        if (!entry) continue;
        if (entry.get('errors').length > 0) {
          hasErrored = true;
        }
        if (entry.get('fileInfo')) {
          loadedCount++;
        }
      }
      if (
        collection.size > 0 &&
        !hasErrored &&
        collection.size === loadedCount &&
        this._collectionState.get('collectionErrors').length === 0
      ) {
        emit(UploaderEventType.COMMON_UPLOAD_SUCCESS, getOutputCollectionState() as OutputCollectionState<'success'>);
      }
    }
    if (changeMap.cdnUrl) {
      const uids = [...changeMap.cdnUrl].filter((uid) => !!collection.read(uid)?.get('cdnUrl'));
      uids.forEach((uid) => {
        emit(UploaderEventType.FILE_URL_CHANGED, getOutputItem(uid));
      });

      this._collectionState.set('groupInfo', null);
    }
  };

  private _flushOutputItems = debounce(async () => {
    const collection = this._collection;
    const config = this._config;
    const emit = this._emit;
    const getOutputCollectionState = this._api.getOutputCollectionState.bind(this._api);
    // Defensive early-return on an inconsistent item set. Compare the uid-list
    // length to `size` directly — the old code built an `OutputFileEntry` for
    // every item via `getOutputItem` just to read `data.length` (a wasted O(N)
    // allocation on every flush); `items().length === data.length`, so this is
    // equivalent without the build.
    if (collection.items().length !== collection.size) {
      return;
    }
    const collectionState = getOutputCollectionState();
    this._collectionState.set('collectionState', collectionState);
    emit(UploaderEventType.CHANGE, () => getOutputCollectionState(), { debounce: true });

    if (config.get('groupOutput') && collectionState.totalCount > 0 && collectionState.status === 'success') {
      this._createGroup(collectionState);
    }
  }, 300);

  private async _createGroup(collectionState: OutputCollectionState): Promise<void> {
    const emit = this._emit;
    const getOutputCollectionState = this._api.getOutputCollectionState.bind(this._api);
    const uploadClientOptions = await this._upload.buildUploadOptions();
    const uuidList = collectionState.allEntries.map((entry) => {
      return entry.uuid + (entry.cdnUrlModifiers ? `/${entry.cdnUrlModifiers}` : '');
    });
    const abortController = new AbortController();
    const resp = await uploadFileGroup(uuidList, {
      ...uploadClientOptions,
      signal: abortController.signal,
    });
    // Bail if the controller was unobserved mid-flight (the `_active` check is
    // new with the controller lifecycle) or the collection state moved on
    // (mirrors v1).
    if (!this._active || this._collectionState.get('collectionState') !== collectionState) {
      abortController.abort();
      return;
    }
    this._collectionState.set('groupInfo', resp);
    const collectionStateWithGroup = getOutputCollectionState() as OutputCollectionState<'success', 'has-group'>;
    emit(UploaderEventType.GROUP_CREATED, collectionStateWithGroup);
    emit(UploaderEventType.CHANGE, () => getOutputCollectionState(), { debounce: true });
    this._collectionState.set('collectionState', collectionStateWithGroup);
  }

  private _flushCommonUploadProgress = (): void => {
    const collection = this._collection;
    const emit = this._emit;
    const getOutputCollectionState = this._api.getOutputCollectionState.bind(this._api);
    let commonProgress = 0;
    const items = this._upload.uploadBatch;
    items.forEach((id) => {
      const uploadProgress = collection.readProp(id, 'uploadProgress');
      if (typeof uploadProgress === 'number') {
        commonProgress += uploadProgress;
      }
    });
    const progress = items.length ? Math.round(commonProgress / items.length) : 0;

    if (this._collectionState.get('commonProgress') === progress) {
      return;
    }

    this._collectionState.set('commonProgress', progress);
    emit(UploaderEventType.COMMON_UPLOAD_PROGRESS, getOutputCollectionState() as OutputCollectionState<'uploading'>);
  };
}
