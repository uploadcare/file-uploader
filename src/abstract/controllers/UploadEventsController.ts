import { type FileFromOptions, type UploadcareGroup, uploadFileGroup } from '@uploadcare/upload-client';
import type { Uid } from '../../lit/Uid';
import type { OutputCollectionState, OutputErrorCollection, OutputFileEntry, OutputFileStatus } from '../../types';
import { debounce } from '../../utils/debounce';
import { type UploaderEventKey, type UploaderEventPayload, UploaderEventType } from '../EventBus';
import { TypedData } from '../TypedData';
import type { UploadEntryData } from '../uploadEntrySchema';
import type { ConfigController } from './ConfigController';
import type {
  CollectionObserver,
  UploadCollectionChangeMap,
  UploadCollectionController,
} from './UploadCollectionController';
import type { ValidationController } from './ValidationController';

type Unsubscribe = () => void;

/** Emit on the event backbone (pure event dispatch — telemetry observes the bus independently, not this call). */
type EmitFn = <T extends UploaderEventKey>(
  type: T,
  payload?: UploaderEventPayload[T] | (() => UploaderEventPayload[T]),
  options?: { debounce?: boolean | number },
) => void;

export type UploadEventsControllerDeps = {
  collection: UploadCollectionController;
  config: ConfigController;
  validation: ValidationController;
  emit: EmitFn;
  getOutputItem: <TStatus extends OutputFileStatus>(uid: Uid) => OutputFileEntry<TStatus>;
  getOutputCollectionState: () => OutputCollectionState;
  getOutputData: () => OutputFileEntry[];
  /** Base upload-client options for the grouped upload (from `UploadController`). */
  buildUploadOptions: () => Promise<FileFromOptions>;
  /** Run plugin `onAdd` hooks for a freshly-added entry. */
  runOnAddHooks: (entry: TypedData<UploadEntryData>) => void;
  /** Apply the `cropPreset` to freshly-uploaded images (lives in the UI layer). */
  applyInitialCrop: () => void;

  // ─── v1 shared-state bridge (`*`-keys via the `$` proxy) ───
  /** The live `*uploadTrigger` set (mutated in place on remove). */
  uploadTrigger: () => Set<Uid>;
  setUploadList: (list: { uid: Uid }[]) => void;
  getCollectionState: () => OutputCollectionState | null;
  setCollectionState: (state: OutputCollectionState | null) => void;
  getCommonProgress: () => number;
  setCommonProgress: (progress: number) => void;
  setGroupInfo: (group: UploadcareGroup | null) => void;
  getCollectionErrors: () => OutputErrorCollection[];
};

const VALIDATION_TRIGGER_KEYS: (keyof UploadEntryData)[] = [
  'file',
  'uploadError',
  'fileInfo',
  'cdnUrl',
  'cdnUrlModifiers',
];

/**
 * DOM-free upload-events engine — the collection→events derivation that v1 ran
 * inline in `LitUploaderBlock` (`_handleCollectionUpdate` /
 * `_handleCollectionPropertiesUpdate` / `_flushOutputItems` /
 * `_flushCommonUploadProgress` / `_createGroup`).
 *
 * It observes the upload collection and, as entries are added/removed and their
 * properties change, drives validation, emits the documented events (via the
 * injected `emit`, a pure event dispatch that reaches the EventBus; telemetry
 * observes that bus independently, not this call), maintains the derived
 * `*uploadList`/`*collectionState`/`*commonProgress`/`*groupInfo` shared state
 * through injected sinks, and creates the output group. All collaborators are
 * injected, so it runs without a DOM and is unit-testable.
 */
export class UploadEventsController {
  private _deps: UploadEventsControllerDeps;
  // Active while observing (the v1 `isConnected` guard) — survives disconnect/
  // reconnect cycles; gates the debounced flush + deferred validation that may
  // fire after the host disconnects.
  private _active = false;
  private _unobserveCollection?: Unsubscribe;
  private _unobserveProperties?: Unsubscribe;

  public constructor(deps: UploadEventsControllerDeps) {
    this._deps = deps;
  }

  /** Start observing the collection. Idempotent. */
  public observe(): void {
    this.unobserve();
    this._active = true;
    this._unobserveCollection = this._deps.collection.observeCollection(this._handleCollectionUpdate);
    this._unobserveProperties = this._deps.collection.observeProperties(this._handleCollectionPropertiesUpdate);
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
    const { validation, emit, getOutputItem } = this._deps;

    if (added.size || removed.size) {
      this._deps.setGroupInfo(null);
    }

    validation.runFileValidators(
      'add',
      [...added].map((e) => e.uid),
    );

    for (const entry of added) {
      if (!entry.getValue('silent')) {
        emit(UploaderEventType.FILE_ADDED, getOutputItem(entry.uid));
      }
      this._deps.runOnAddHooks(entry);
    }

    validation.runCollectionValidators();

    for (const entry of removed) {
      this._deps.uploadTrigger().delete(entry.uid);

      validation.cleanupValidationForEntry(entry);
      entry.getValue('abortController')?.abort();
      entry.setMultipleValues({
        isRemoved: true,
        abortController: null,
        isUploading: false,
        uploadProgress: 0,
      });
      const thumbUrl = entry?.getValue('thumbUrl');
      thumbUrl && URL.revokeObjectURL(thumbUrl);
      emit(UploaderEventType.FILE_REMOVED, getOutputItem(entry.uid));
    }

    this._deps.setUploadList(entries.map((uid) => ({ uid })));

    this._flushCommonUploadProgress();
    this._flushOutputItems();
  };

  private _handleCollectionPropertiesUpdate = (changeMap: UploadCollectionChangeMap): void => {
    if (!this._active) return;
    const { collection, config, validation, emit, getOutputItem, getOutputCollectionState } = this._deps;

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
            changeMap.fileInfo?.has(entryId) && !!TypedData.getByUid<UploadEntryData>(entryId)?.snapshot().fileInfo,
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
        const { isUploading, silent } = entry.snapshot();
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
        const { isUploading, silent } = entry.snapshot();
        if (isUploading && !silent) {
          emit(UploaderEventType.FILE_UPLOAD_START, getOutputItem(entryId));
        }
      }
    }
    if (changeMap.fileInfo) {
      for (const entryId of changeMap.fileInfo) {
        const entry = TypedData.getByUid<UploadEntryData>(entryId);
        if (!entry) continue;
        const { fileInfo, silent } = entry.snapshot();
        if (fileInfo && !silent) {
          emit(UploaderEventType.FILE_UPLOAD_SUCCESS, getOutputItem(entryId));
        }
      }
      if (config.get('cropPreset')) {
        this._deps.applyInitialCrop();
      }
    }
    if (changeMap.errors) {
      validation.runCollectionValidators();

      for (const entryId of changeMap.errors) {
        const entry = TypedData.getByUid<UploadEntryData>(entryId);
        if (!entry) continue;
        const { errors } = entry.snapshot();
        if (errors.length > 0) {
          emit(UploaderEventType.FILE_UPLOAD_FAILED, getOutputItem(entryId));
          emit(
            UploaderEventType.COMMON_UPLOAD_FAILED,
            () => getOutputCollectionState() as OutputCollectionState<'failed'>,
            { debounce: true },
          );
        }
      }
      const loadedItems = collection.findItems((entry) => !!entry.getValue('fileInfo'));
      const errorItems = collection.findItems((entry) => entry.getValue('errors').length > 0);
      if (
        collection.size > 0 &&
        errorItems.length === 0 &&
        collection.size === loadedItems.length &&
        this._deps.getCollectionErrors().length === 0
      ) {
        emit(UploaderEventType.COMMON_UPLOAD_SUCCESS, getOutputCollectionState() as OutputCollectionState<'success'>);
      }
    }
    if (changeMap.cdnUrl) {
      const uids = [...changeMap.cdnUrl].filter((uid) => !!collection.read(uid)?.getValue('cdnUrl'));
      uids.forEach((uid) => {
        emit(UploaderEventType.FILE_URL_CHANGED, getOutputItem(uid));
      });

      this._deps.setGroupInfo(null);
    }
  };

  private _flushOutputItems = debounce(async () => {
    const { collection, config, emit, getOutputCollectionState, getOutputData, setCollectionState } = this._deps;
    const data = getOutputData();
    if (data.length !== collection.size) {
      return;
    }
    const collectionState = getOutputCollectionState();
    setCollectionState(collectionState);
    emit(UploaderEventType.CHANGE, () => getOutputCollectionState(), { debounce: true });

    if (config.get('groupOutput') && collectionState.totalCount > 0 && collectionState.status === 'success') {
      this._createGroup(collectionState);
    }
  }, 300);

  private async _createGroup(collectionState: OutputCollectionState): Promise<void> {
    const { emit, getOutputCollectionState, getCollectionState, setCollectionState, setGroupInfo, buildUploadOptions } =
      this._deps;
    const uploadClientOptions = await buildUploadOptions();
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
    if (!this._active || getCollectionState() !== collectionState) {
      abortController.abort();
      return;
    }
    setGroupInfo(resp);
    const collectionStateWithGroup = getOutputCollectionState() as OutputCollectionState<'success', 'has-group'>;
    emit(UploaderEventType.GROUP_CREATED, collectionStateWithGroup);
    emit(UploaderEventType.CHANGE, () => getOutputCollectionState(), { debounce: true });
    setCollectionState(collectionStateWithGroup);
  }

  private _flushCommonUploadProgress = (): void => {
    const { collection, emit, getOutputCollectionState, getCommonProgress, setCommonProgress } = this._deps;
    let commonProgress = 0;
    const items = [...this._deps.uploadTrigger()].filter((id) => !!collection.read(id));
    items.forEach((id) => {
      const uploadProgress = collection.readProp(id, 'uploadProgress');
      if (typeof uploadProgress === 'number') {
        commonProgress += uploadProgress;
      }
    });
    const progress = items.length ? Math.round(commonProgress / items.length) : 0;

    if (getCommonProgress() === progress) {
      return;
    }

    setCommonProgress(progress);
    emit(UploaderEventType.COMMON_UPLOAD_PROGRESS, getOutputCollectionState() as OutputCollectionState<'uploading'>);
  };
}
