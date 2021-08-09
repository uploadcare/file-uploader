const frz = function(obj) {
  return Object.freeze(obj);
};

export const ENUM = frz({
  TAG: frz({
    ACTIVITY_MNGR: {

    }
  }),
  CSS: {
    CFG: frz({
      PUBKEY: '--cfg-pubkey',
      MULTIPLE: '--cfg-multiple',
      CONFIRM_UPLOAD: '--cfg-confirm-upload',
      IMG_ONLY: '--cfg-img-only',
      ACCEPT: '--cfg-accept',
      STORE: '--cfg-store',
      CAMERA_MIRROR: '--cfg-camera-mirror',
      EXT_SOURCE_LIST: '--cfg-ext-source-list',
      MAX_FILES: '--cfg-max-files',
    }),
    L10N: {

    },
  },
  ACT: frz({

  }),
});