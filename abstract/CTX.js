// @ts-check
import { Queue } from '@uploadcare/upload-client';

export const blockCtx = () => ({
  /** @type {Set<import('./Block').Block>} */
  '*blocksRegistry': new Set(),
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
  '*outputData': null,
  '*focusedEntry': null,
  '*uploadMetadata': null,
  '*uploadQueue': new Queue(1),
});
