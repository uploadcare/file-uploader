// @ts-check

/**
 * @template {import('../index.js').OutputCollectionStatus} TCollectionStatus
 * @template {import('../index.js').GroupFlag} [TGroupFlag='maybe-has-group'] Default is `'maybe-has-group'`
 * @param {import('./UploaderBlock.js').UploaderBlock} uploaderBlock
 * @returns {import('../index.js').OutputCollectionState<TCollectionStatus, TGroupFlag>}
 */
export function buildOutputCollectionState(uploaderBlock) {
  /** @type {ReturnType<typeof uploaderBlock.getOutputData> | null} */
  let allEntriesCache = null;

  const state = {
    progress: uploaderBlock.$['*commonProgress'],
    errors: uploaderBlock.$['*collectionErrors'],
    group: uploaderBlock.$['*groupInfo'],

    get totalCount() {
      return uploaderBlock.uploadCollection.size;
    },

    get failedCount() {
      return this.failedEntries.length;
    },

    get successCount() {
      return this.successEntries.length;
    },

    get uploadingCount() {
      return this.uploadingEntries.length;
    },

    get status() {
      let status = /** @type {TCollectionStatus} */ (
        /** @type {unknown} */ (
          this.isFailed ? 'failed' : this.isUploading ? 'uploading' : this.isSuccess ? 'success' : 'idle'
        )
      );
      return status;
    },

    get isSuccess() {
      return this.errors.length === 0 && this.successEntries.length === this.allEntries.length;
    },

    get isUploading() {
      return this.allEntries.some((entry) => entry.status === 'uploading');
    },

    get isFailed() {
      return this.errors.length > 0 || this.failedEntries.length > 0;
    },

    get allEntries() {
      if (allEntriesCache) {
        return allEntriesCache;
      }
      allEntriesCache = uploaderBlock.getOutputData();
      return allEntriesCache;
    },

    get successEntries() {
      return this.allEntries.filter((entry) => entry.status === 'success');
    },

    get failedEntries() {
      return this.allEntries.filter((entry) => entry.status === 'failed');
    },

    get uploadingEntries() {
      return this.allEntries.filter((entry) => entry.status === 'uploading');
    },
  };

  return /** @type {import('../index.js').OutputCollectionState<TCollectionStatus, TGroupFlag>} */ (
    /** @type {unknown} */ (state)
  );
}
