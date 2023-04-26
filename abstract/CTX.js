import { Queue } from '@uploadcare/upload-client';

export const blockCtx = () => ({
  /** @type {Set<import('./Block').Block>} */
  '*blocksRegistry': new Set(),
});

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

export const uploaderBlockCtx = (fnCtx) => ({
  ...activityBlockCtx(fnCtx),
  '*commonProgress': 0,
  '*uploadList': [],
  '*outputData': null,
  '*focusedEntry': null,
  '*uploadMetadata': null,
  '*uploadQueue': new Queue(1),
});
