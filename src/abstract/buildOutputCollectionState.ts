import { getOutputData } from '../lit/getOutputData';
import type {
  GroupFlag,
  OutputCollectionState,
  OutputCollectionStatus,
  OutputErrorCollection,
  OutputFileEntry,
  UploadcareGroup,
} from '../types/index';
import { memoize } from '../utils/memoize';
import { CollectionStateController } from './controllers/CollectionStateController';
import { UploadCollectionController } from './controllers/UploadCollectionController';
import type { ControllerContainer } from './di/ControllerContainer';
import { logger } from './logger';

const log = logger.scope('output-collection-state');

function createAsyncAssertWrapper(warning: string) {
  let isAsync = false;
  setTimeout(() => {
    isAsync = true;
  }, 0);

  const withAssert = <TArgs extends unknown[], TReturn, T extends (...args: TArgs) => TReturn>(fn: T): T => {
    return ((...args) => {
      if (isAsync) {
        log.warnOnce(warning);
      }
      return fn(...args);
    }) as T;
  };

  return withAssert;
}

export function buildOutputCollectionState<
  TCollectionStatus extends OutputCollectionStatus,
  TGroupFlag extends GroupFlag = 'maybe-has-group',
>(container: ControllerContainer): OutputCollectionState<TCollectionStatus, TGroupFlag> {
  const state = {} as OutputCollectionState<TCollectionStatus, TGroupFlag>;
  // Derived collection keys read straight off the controllers.
  // `CollectionStateController` owns `*commonProgress`/`*collectionErrors`/
  // `*groupInfo` (the same instance the v1 ctx facade routes those keys through).
  const collectionState = container.get(CollectionStateController);
  const uploadCollection = container.get(UploadCollectionController);

  // Partition all entries by derived status in ONE pass (memoized), so counts,
  // the four per-status arrays, and the status flags don't each re-filter the
  // whole list. Was O(N × ~5) filters/scans per state; now O(N) once. The result
  // is identical to the per-getter `.filter(status === …)` it replaces (a
  // `removed` entry lands in no bucket, exactly as the old filters excluded it).
  const partitionByStatus = memoize(() => {
    const success: OutputFileEntry<'success'>[] = [];
    const failed: OutputFileEntry<'failed'>[] = [];
    const uploading: OutputFileEntry<'uploading'>[] = [];
    const idle: OutputFileEntry<'idle'>[] = [];
    for (const entry of state.allEntries) {
      switch (entry.status) {
        case 'success':
          success.push(entry as OutputFileEntry<'success'>);
          break;
        case 'failed':
          failed.push(entry as OutputFileEntry<'failed'>);
          break;
        case 'uploading':
          uploading.push(entry as OutputFileEntry<'uploading'>);
          break;
        case 'idle':
          idle.push(entry as OutputFileEntry<'idle'>);
          break;
      }
    }
    return { success, failed, uploading, idle };
  });

  const getters = {
    progress: (): number => {
      return collectionState.get('commonProgress');
    },
    errors: (): OutputErrorCollection[] => {
      return collectionState.get('collectionErrors');
    },

    group: (): UploadcareGroup | null => {
      return collectionState.get('groupInfo');
    },

    totalCount: (): number => {
      return uploadCollection.size;
    },

    failedCount: (): number => {
      return partitionByStatus().failed.length;
    },

    successCount: (): number => {
      return partitionByStatus().success.length;
    },

    uploadingCount: (): number => {
      return partitionByStatus().uploading.length;
    },

    status: (): TCollectionStatus => {
      const status = state.isFailed ? 'failed' : state.isUploading ? 'uploading' : state.isSuccess ? 'success' : 'idle';
      return status as TCollectionStatus;
    },

    isSuccess: (): boolean => {
      return (
        state.allEntries.length > 0 &&
        state.errors.length === 0 &&
        partitionByStatus().success.length === state.allEntries.length
      );
    },

    isUploading: (): boolean => {
      return partitionByStatus().uploading.length > 0;
    },

    isFailed: (): boolean => {
      return state.errors.length > 0 || partitionByStatus().failed.length > 0;
    },

    allEntries: (): OutputFileEntry[] => {
      return getOutputData(container);
    },

    successEntries: (): OutputFileEntry<'success'>[] => {
      return partitionByStatus().success;
    },

    failedEntries: (): OutputFileEntry<'failed'>[] => {
      return partitionByStatus().failed;
    },

    uploadingEntries: (): OutputFileEntry<'uploading'>[] => {
      return partitionByStatus().uploading;
    },

    idleEntries: (): OutputFileEntry<'idle'>[] => {
      return partitionByStatus().idle;
    },
  };

  const withAssert = createAsyncAssertWrapper(
    "You're trying to access the OutputCollectionState asynchronously. " +
      'In this case, the data you retrieve will be newer than it was when the ' +
      'OutputCollectionState was created or when the event was dispatched. If you want ' +
      'to retain the state at a specific moment in time, you should use the spread operator ' +
      'like this: `{...outputCollectionState}` or `{...e.detail}`',
  );

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
