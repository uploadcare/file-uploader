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
import { warnOnce } from '../utils/warnOnce';
import { CollectionStateController } from './controllers/CollectionStateController';
import { UploadCollectionController } from './controllers/UploadCollectionController';
import type { ControllerContainer } from './di/ControllerContainer';

function createAsyncAssertWrapper(warning: string) {
  let isAsync = false;
  setTimeout(() => {
    isAsync = true;
  }, 0);

  const withAssert = <TArgs extends unknown[], TReturn, T extends (...args: TArgs) => TReturn>(fn: T): T => {
    return ((...args) => {
      if (isAsync) {
        warnOnce(warning);
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
  // M-god step 9c-1: derived collection keys read straight off the controllers
  // (was `ctx.read('*commonProgress')` etc. and `bag.uploadCollection.size`).
  // `CollectionStateController` owns `*commonProgress`/`*collectionErrors`/
  // `*groupInfo` (the same instance `PubSubCompat` routes those keys through), so
  // these reads are byte-identical to the old `ctx.read`.
  const collectionState = container.get(CollectionStateController);
  const uploadCollection = container.get(UploadCollectionController);

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
      return state.failedEntries.length;
    },

    successCount: (): number => {
      return state.successEntries.length;
    },

    uploadingCount: (): number => {
      return state.uploadingEntries.length;
    },

    status: (): TCollectionStatus => {
      const status = state.isFailed ? 'failed' : state.isUploading ? 'uploading' : state.isSuccess ? 'success' : 'idle';
      return status as TCollectionStatus;
    },

    isSuccess: (): boolean => {
      return (
        state.allEntries.length > 0 &&
        state.errors.length === 0 &&
        state.successEntries.length === state.allEntries.length
      );
    },

    isUploading: (): boolean => {
      return state.allEntries.some((entry: OutputFileEntry) => entry.status === 'uploading');
    },

    isFailed: (): boolean => {
      return state.errors.length > 0 || state.failedEntries.length > 0;
    },

    allEntries: (): OutputFileEntry[] => {
      return getOutputData(container);
    },

    successEntries: (): OutputFileEntry<'success'>[] => {
      return state.allEntries.filter(
        (entry: OutputFileEntry) => entry.status === 'success',
      ) as OutputFileEntry<'success'>[];
    },

    failedEntries: (): OutputFileEntry<'failed'>[] => {
      return state.allEntries.filter(
        (entry: OutputFileEntry) => entry.status === 'failed',
      ) as OutputFileEntry<'failed'>[];
    },

    uploadingEntries: (): OutputFileEntry<'uploading'>[] => {
      return state.allEntries.filter(
        (entry: OutputFileEntry) => entry.status === 'uploading',
      ) as OutputFileEntry<'uploading'>[];
    },

    idleEntries: (): OutputFileEntry<'idle'>[] => {
      return state.allEntries.filter((entry: OutputFileEntry) => entry.status === 'idle') as OutputFileEntry<'idle'>[];
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
