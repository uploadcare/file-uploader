// @ts-check
import { Queue } from '@uploadcare/upload-client';

export const blockCtx = () => ({
  /** @type {Set<import('./Block').Block>} */
  '*blocksRegistry': new Set(),
  /** @type {import('../blocks/UploadCtxProvider/EventEmitter.js').EventEmitter | null} */
  '*eventEmitter': null,
});

/** @param {import('./Block').Block} fnCtx */
export const activityBlockCtx = (fnCtx) => ({
  ...blockCtx(),
  '*currentActivity': '',
  '*currentActivityParams': {},
  '*history': [],
  '*historyBack': null,
  '*closeModal': () => {
    fnCtx.set$({
      '*modalActive': false,
      '*currentActivity': '',
    });
  },
});

/** @param {import('./Block').Block} fnCtx */
export const uploaderBlockCtx = (fnCtx) => ({
  ...activityBlockCtx(fnCtx),
  '*commonProgress': 0,
  '*uploadList': [],
  '*focusedEntry': null,
  '*uploadMetadata': null,
  '*uploadQueue': new Queue(1),
  '*uploadCollection': null,
  /** @type {ReturnType<import('../utils/buildOutputError.js').buildCollectionFileError>[]} */
  '*collectionErrors': [],
  /** @type {import('../types').OutputCollectionState | null} */
  '*collectionState': null,
  /** @type {import('@uploadcare/upload-client').UploadcareGroup | null} */
  '*groupInfo': null,
  /** @type {Set<string>} */
  '*uploadTrigger': new Set(),
});
