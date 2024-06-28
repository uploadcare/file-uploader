// @ts-check

import { memoize } from '../utils/memoize.js';
import { warnOnce } from '../utils/warnOnce.js';

/** @param {string} warning */
function createAsyncAssertWrapper(warning) {
  let isAsync = false;
  setTimeout(() => {
    isAsync = true;
  }, 0);

  /**
   * @template {any[]} TArgs
   * @template {any} TReturn
   * @template {(...args: TArgs) => TReturn} T
   * @param {T} fn
   * @returns {T}
   */
  const withAssert = (fn) => {
    return /** @type {T} */ (
      (...args) => {
        if (isAsync) {
          warnOnce(warning);
        }
        return fn(...args);
      }
    );
  };

  return withAssert;
}

/**
 * @template {import('../index.js').OutputCollectionStatus} TCollectionStatus
 * @template {import('../index.js').GroupFlag} [TGroupFlag='maybe-has-group'] Default is `'maybe-has-group'`
 * @param {import('./UploaderBlock.js').UploaderBlock} uploaderBlock
 * @returns {import('../index.js').OutputCollectionState<TCollectionStatus, TGroupFlag>}
 */
export function buildOutputCollectionState(uploaderBlock) {
  const getters = {
    /** @returns {number} */
    progress: () => {
      return uploaderBlock.$['*commonProgress'];
    },
    /** @returns {ReturnType<import('../types').OutputErrorFile>[]} */
    errors: () => {
      return uploaderBlock.$['*collectionErrors'];
    },

    /** @returns {import('@uploadcare/upload-client').UploadcareGroup | null} */
    group: () => {
      return uploaderBlock.$['*groupInfo'];
    },

    totalCount: () => {
      return uploaderBlock.uploadCollection.size;
    },

    failedCount: () => {
      return state.failedEntries.length;
    },

    successCount: () => {
      return state.successEntries.length;
    },

    uploadingCount: () => {
      return state.uploadingEntries.length;
    },

    status: () => {
      const status = state.isFailed ? 'failed' : state.isUploading ? 'uploading' : state.isSuccess ? 'success' : 'idle';
      return /** @type {TCollectionStatus} */ (status);
    },

    isSuccess: () => {
      return (
        state.allEntries.length > 0 &&
        state.errors.length === 0 &&
        state.successEntries.length === state.allEntries.length
      );
    },

    isUploading: () => {
      return state.allEntries.some((entry) => entry.status === 'uploading');
    },

    isFailed: () => {
      return state.errors.length > 0 || state.failedEntries.length > 0;
    },

    allEntries: () => {
      return uploaderBlock.getOutputData();
    },

    successEntries: () => {
      return state.allEntries.filter((entry) => entry.status === 'success');
    },

    failedEntries: () => {
      return state.allEntries.filter((entry) => entry.status === 'failed');
    },

    uploadingEntries: () => {
      return state.allEntries.filter((entry) => entry.status === 'uploading');
    },

    idleEntries: () => {
      return state.allEntries.filter((entry) => entry.status === 'idle');
    },
  };

  const state = /** @type {import('../index.js').OutputCollectionState<TCollectionStatus, TGroupFlag>} */ (
    /** @type {unknown} */ ({})
  );
  const withAssert = createAsyncAssertWrapper(
    "You're trying to access the OutputCollectionState asynchronously. " +
      'In this case, the data you retrieve will be newer than it was when the ' +
      'OutputCollectionState was created or when the event was dispatched. If you want ' +
      'to retain the state at a specific moment in time, you should use the spread operator ' +
      'like this: `{...outputCollectionState}` or `{...e.detail}`',
  );

  for (const [key, value] of Object.entries(getters)) {
    const name = /** @type {keyof typeof getters} */ (key);
    const getter = /** @type {(typeof getters)[name]} */ (value);
    const wrapped = memoize(withAssert(getter));
    Object.defineProperty(state, name, {
      get: wrapped,
      enumerable: true,
    });
  }

  return state;
}
