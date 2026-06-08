import type { UploaderController } from '../abstract/controllers/UploaderController';
import type {
  GroupFlag,
  OutputCollectionState,
  OutputCollectionStatus,
  OutputErrorCollection,
  OutputFileEntry,
  UploadcareGroup,
} from '../types/exported';
import { memoize } from '../utils/memoize';
import { warnOnce } from '../utils/warnOnce';
import type { UploadEntry } from './UploadEntry';

const ASYNC_ACCESS_WARNING =
  "You're trying to access the OutputCollectionState asynchronously. " +
  'In this case, the data you retrieve will be newer than it was when the ' +
  'OutputCollectionState was created or when the event was dispatched. If you want ' +
  'to retain the state at a specific moment in time, you should use the spread operator ' +
  'like this: `{...outputCollectionState}` or `{...e.detail}`';

function createAsyncAssertWrapper(warning: string) {
  let isAsync = false;
  setTimeout(() => {
    isAsync = true;
  }, 0);
  return <TArgs extends unknown[], TReturn, F extends (...args: TArgs) => TReturn>(fn: F): F =>
    ((...args: TArgs): TReturn => {
      if (isAsync) warnOnce(warning);
      return fn(...args);
    }) as F;
}

/**
 * Mirror of v1's `UploaderPublicApi.getOutputItem`. Materializes a full
 * `OutputFileEntry` from an `UploadEntry`, including the boolean status
 * convenience flags and `fileInfo`/`metadata`/`fullPath` fields.
 */
export function getOutputItem(entry: UploadEntry): OutputFileEntry {
  const fileInfo = entry.getValue('fileInfo');
  const errors = entry.getValue('errors');
  const isRemoved = entry.getValue('isRemoved');
  const isUploading = entry.getValue('isUploading');

  const status: OutputFileEntry['status'] = isRemoved
    ? 'removed'
    : errors.length > 0
      ? 'failed'
      : fileInfo
        ? 'success'
        : isUploading
          ? 'uploading'
          : 'idle';

  return {
    status,
    internalId: entry.internalId,
    name: fileInfo?.originalFilename ?? entry.getValue('fileName') ?? '',
    size: fileInfo?.size ?? entry.getValue('fileSize') ?? 0,
    isImage: fileInfo?.isImage ?? entry.getValue('isImage'),
    mimeType: fileInfo?.mimeType ?? entry.getValue('mimeType') ?? '',
    metadata: entry.getValue('metadata') ?? fileInfo?.metadata ?? null,
    file: entry.getValue('file'),
    externalUrl: entry.getValue('externalUrl'),
    uploadProgress: entry.getValue('uploadProgress'),
    fullPath: entry.getValue('fullPath'),
    source: entry.getValue('source') as OutputFileEntry['source'],
    isValidationPending: entry.getValue('isValidationPending'),

    uuid: fileInfo?.uuid ?? entry.getValue('uuid') ?? null,
    cdnUrl: entry.getValue('cdnUrl') ?? fileInfo?.cdnUrl ?? null,
    cdnUrlModifiers: entry.getValue('cdnUrlModifiers'),
    fileInfo: fileInfo ?? null,
    isSuccess: status === 'success',
    isUploading: status === 'uploading',
    isFailed: status === 'failed',
    isRemoved: status === 'removed',
    errors: errors as OutputFileEntry['errors'],
  } as OutputFileEntry;
}

/**
 * Port of v1's `buildOutputCollectionState`. Reads live state off the v2
 * controllers — collection items, upload group, validation errors — and
 * exposes them as memoized getters so consumers can access individual
 * fields without paying the cost of materializing the full collection.
 *
 * Getters warn on async access (after the current task) so consumers
 * spread the state when they need to keep it.
 */
export function buildOutputCollectionState<
  TCollectionStatus extends OutputCollectionStatus = OutputCollectionStatus,
  TGroupFlag extends GroupFlag = 'maybe-has-group',
>(controller: UploaderController): OutputCollectionState<TCollectionStatus, TGroupFlag> {
  const state = {} as OutputCollectionState<TCollectionStatus, TGroupFlag>;
  const collection = controller.collection;
  const upload = controller.upload;
  const validation = controller.validation;

  const getters = {
    progress: (): number => {
      const entries = collection.entries.filter((e) => e.getValue('isUploading') || e.getValue('fileInfo'));
      if (entries.length === 0) return 0;
      let total = 0;
      for (const e of entries) total += e.getValue('uploadProgress');
      return Math.round(total / entries.length);
    },

    errors: (): OutputErrorCollection[] => {
      return [...validation.collectionErrors];
    },

    group: (): UploadcareGroup | null => {
      return upload.group;
    },

    totalCount: (): number => {
      return collection.size;
    },

    failedCount: (): number => {
      return state.failedEntries.length;
    },

    successCount: (): number => {
      return state.successEntries.length;
    },

    uploadingCount: (): number => {
      return state.uploadingEntries.length;
    },

    status: (): TCollectionStatus => {
      const s = state.isFailed ? 'failed' : state.isUploading ? 'uploading' : state.isSuccess ? 'success' : 'idle';
      return s as TCollectionStatus;
    },

    isSuccess: (): boolean => {
      return (
        state.allEntries.length > 0 &&
        state.errors.length === 0 &&
        state.successEntries.length === state.allEntries.length
      );
    },

    isUploading: (): boolean => {
      return state.allEntries.some((e) => e.status === 'uploading');
    },

    isFailed: (): boolean => {
      return state.errors.length > 0 || state.failedEntries.length > 0;
    },

    allEntries: (): OutputFileEntry[] => {
      return collection.entries.map(getOutputItem);
    },

    successEntries: (): OutputFileEntry<'success'>[] => {
      return state.allEntries.filter((e) => e.status === 'success') as OutputFileEntry<'success'>[];
    },

    failedEntries: (): OutputFileEntry<'failed'>[] => {
      return state.allEntries.filter((e) => e.status === 'failed') as OutputFileEntry<'failed'>[];
    },

    uploadingEntries: (): OutputFileEntry<'uploading'>[] => {
      return state.allEntries.filter((e) => e.status === 'uploading') as OutputFileEntry<'uploading'>[];
    },

    idleEntries: (): OutputFileEntry<'idle'>[] => {
      return state.allEntries.filter((e) => e.status === 'idle') as OutputFileEntry<'idle'>[];
    },
  };

  const withAssert = createAsyncAssertWrapper(ASYNC_ACCESS_WARNING);

  for (const [key, value] of Object.entries(getters)) {
    const name = key as keyof typeof getters;
    const getter = value as (typeof getters)[typeof name];
    const wrapped = memoize(withAssert(getter));
    Object.defineProperty(state, name, {
      get: wrapped,
      enumerable: true,
    });
  }

  return state;
}
