import { TRANSPARENT_PIXEL_SRC } from './lib/transparentPixelSrc.js';
import { constructCdnUrl, transformationsToString } from './lib/cdnUtils.js';

export function initState(fnCtx) {
  return {
    '*originalUrl': null,
    '*tabId': null,
    '*faderEl': null,
    '*cropperEl': null,
    '*imgEl': null,
    '*imgContainerEl': null,
    '*modalEl': fnCtx,
    '*networkProblems': false,
    '*imageSize': null,

    entry: null,
    extension: null,
    editorMode: false,
    modalCaption: '',
    isImage: false,
    msg: '',
    src: TRANSPARENT_PIXEL_SRC,
    fileType: '',
    showLoader: false,
    uuid: null,

    'presence.networkProblems': false,
    'presence.modalCaption': true,
    'presence.editorToolbar': false,
    'presence.viewerToolbar': true,

    '*on.retryNetwork': () => {
      let images = fnCtx.shadowRoot.querySelectorAll('img');
      for (let img of images) {
        let originalSrc = img.src;
        img.src = TRANSPARENT_PIXEL_SRC;
        img.src = originalSrc;
      }
      fnCtx.$['*networkProblems'] = false;
    },
    '*on.apply': (transformations) => {
      if (!transformations) {
        return;
      }
      let transformationsUrl = constructCdnUrl(
        fnCtx.$['*originalUrl'],
        transformationsToString(transformations),
        'preview'
      );
      fnCtx.dispatchEvent(
        new CustomEvent('apply', {
          detail: {
            originalUrl: fnCtx.$['*originalUrl'],
            transformationsUrl,
            transformations,
          },
        })
      );
      fnCtx.remove();
    },
    '*on.cancel': () => {
      fnCtx.remove();

      fnCtx.dispatchEvent(new CustomEvent('cancel'));
    },
  };
}
