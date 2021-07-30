import { COND, STYLES } from './styles.js';
import { TRANSPARENT_PIXEL_SRC } from './lib/transparentPixelSrc.js';
import { constructCdnUrl, COMMON_OPERATIONS, transformationsToString } from './lib/cdnUtils.js';

export function initState(fnCtx) {
  return {
    entry: null,
    extension: null,
    originalUrl: null,
    transformations: null,
    editorMode: false,
    editorToolbarEl: null,
    faderEl: null,
    cropperEl: null,
    imgEl: null,
    imgContainerEl: null,
    modalEl: fnCtx,
    ctxProvider: fnCtx,
    modalCaption: '',
    isImage: false,
    msg: '',
    src: TRANSPARENT_PIXEL_SRC,
    fileType: '',
    widthBreakpoint: null,
    showLoader: false,
    networkProblems: false,
    imageSize: null,
    uuid: null,
    'public-key': null,

    'css.wrapper': 'wrapper _desktop',
    'css.image': COND.img_visible_editor,

    'presence.networkProblems': false,
    'presence.modalCaption': true,
    'presence.editorToolbar': false,
    'presence.viewerToolbar': true,

    'on.retryNetwork': () => {
      let images = fnCtx.shadowRoot.querySelectorAll('img');
      for (let img of images) {
        let originalSrc = img.src;
        img.src = TRANSPARENT_PIXEL_SRC;
        img.src = originalSrc;
      }
      fnCtx.state.networkProblems = false;
    },
    'on.close': () => {
      fnCtx.remove();
    },
  };
}
