// @ts-check

import { memoize } from '../utils/memoize.js';

/** @param {string} warning */
function createAsyncAssertWrapper(warning) {
  let isAsync = false;
  setTimeout(() => {
    isAsync = true;
  }, 0);

  /**
   * @template {unknown[]} TArgs
   * @template {unknown} TReturn
   * @param {(...args: TArgs) => TReturn} fn
   * @returns {(...args: TArgs) => TReturn}
   */
  const withAssert = (fn) => {
    return (...args) => {
      if (isAsync) {
        console.warn(warning);
      }
      return fn(...args);
    };
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
    /** @returns {ReturnType<import('../utils/buildOutputError.js').buildCollectionFileError>[]} */
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
      return getters.failedEntries().length;
    },

    successCount: () => {
      return getters.successEntries().length;
    },

    uploadingCount: () => {
      return getters.uploadingEntries().length;
    },

    status: () => {
      const status = getters.isFailed()
        ? 'failed'
        : getters.isUploading()
          ? 'uploading'
          : getters.isSuccess()
            ? 'success'
            : 'idle';
      return /** @type {TCollectionStatus} */ (status);
    },

    isSuccess: () => {
      return getters.errors().length === 0 && getters.successEntries().length === getters.allEntries().length;
    },

    isUploading: () => {
      return getters.allEntries().some((entry) => entry.status === 'uploading');
    },

    isFailed: () => {
      return getters.errors().length > 0 || getters.failedEntries().length > 0;
    },

    allEntries: () => {
      return uploaderBlock.getOutputData();
    },

    successEntries: () => {
      return getters.allEntries().filter((entry) => entry.status === 'success');
    },

    failedEntries: () => {
      return getters.allEntries().filter((entry) => entry.status === 'failed');
    },

    uploadingEntries: () => {
      return getters.allEntries().filter((entry) => entry.status === 'uploading');
    },
  };

  const state = {};
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
    // @ts-expect-error
    const wrapped = memoize(withAssert(getter));
    Object.defineProperty(state, name, {
      get: wrapped,
      enumerable: true,
    });
  }

  return /** @type {import('../index.js').OutputCollectionState<TCollectionStatus, TGroupFlag>} */ (
    /** @type {unknown} */ (state)
  );
}
