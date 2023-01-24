export const blockCtx = () => ({
  '*ctxTargetsRegistry': new Map(),
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
