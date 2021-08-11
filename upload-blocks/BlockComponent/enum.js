const frz = function(obj) {
  return Object.freeze(obj);
};

const CFG = {
  PUBKEY: '--cfg-pubkey',
  MULTIPLE: '--cfg-multiple',
  CONFIRM_UPLOAD: '--cfg-confirm-upload',
  IMG_ONLY: '--cfg-img-only',
  ACCEPT: '--cfg-accept',
  STORE: '--cfg-store',
  CAMERA_MIRROR: '--cfg-camera-mirror',
  EXT_SRC_LIST: '--cfg-ext-source-list',
  MAX_FILES: '--cfg-max-files',
};

const ACT = {

};

const L10N = {

};

export const ENUM = frz({
  TAG: frz({
    ACTIVITY_MNGR: {

    }
  }),
  CSS: {
    CFG: frz(CFG),
    L10N: frz(L10N),
  },
  ACT: frz(ACT),
});