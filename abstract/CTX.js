export const blockCtx = () => ({
  /** @type {Set<import('./Block').Block>} */
  '*blocksRegistry': new Set(),
});

export const activityBlockCtx = () => ({
  ...blockCtx(),
  '*currentActivity': '',
  '*currentActivityParams': {},
  '*history': [],
  '*activityCaption': '',
  '*activityIcon': '',
});

export const uploaderBlockCtx = () => ({
  ...activityBlockCtx(),
  '*commonProgress': 0,
  '*uploadList': [],
  '*outputData': null,
  '*focusedEntry': null,
  '*uploadMetadata': null,
});
