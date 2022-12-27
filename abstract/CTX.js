export const blockCtx = () => ({
  /** @type {Set<import('./Block').Block>} */
  '*blocksRegistry': new Set(),
});

export const activityBlockCtx = () => ({
  ...blockCtx(),
  '*currentActivity': '',
  '*currentActivityParams': {},
  '*history': [],
  '*historyBack': null,
});

export const uploaderBlockCtx = () => ({
  ...activityBlockCtx(),
  '*commonProgress': 0,
  '*uploadList': [],
  '*outputData': null,
  '*focusedEntry': null,
  '*uploadMetadata': null,
});
