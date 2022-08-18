export const BLOCK_CTX = {
  '*ctxTargetsRegistry': new Set(),
};

export const ACTIVITY_BLOCK_CTX = {
  ...BLOCK_CTX,
  '*currentActivity': '',
  '*currentActivityParams': {},
  '*history': [],
  '*activityCaption': '',
  '*activityIcon': '',
};

export const UPLOADER_BLOCK_CTX = {
  ...ACTIVITY_BLOCK_CTX,
  '*commonProgress': 0,
  '*uploadList': [],
  '*outputData': null,
  '*focusedEntry': null,
  '*uploadMetadata': null,
};
