import { TRANSPARENT_PIXEL_SRC } from './lib/transparentPixelSrc.js'
import { constructCdnUrl, transformationsToString } from './lib/cdnUtils.js'

export function initState(fnCtx) {
  return {
    entry: null,
    extension: null,
    originalUrl: null,
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

    'presence.networkProblems': false,
    'presence.modalCaption': true,
    'presence.editorToolbar': false,
    'presence.viewerToolbar': true,

    'on.retryNetwork': () => {
      let images = fnCtx.shadowRoot.querySelectorAll('img')
      for (let img of images) {
        let originalSrc = img.src
        img.src = TRANSPARENT_PIXEL_SRC
        img.src = originalSrc
      }
      fnCtx.state.networkProblems = false
    },
    'on.apply': (transformations) => {
      fnCtx.remove()
      if (!transformations) {
        return
      }
      let transformationsUrl = constructCdnUrl(
        fnCtx.state.originalUrl,
        transformationsToString(transformations),
        'preview',
      )

      fnCtx.dispatchEvent(
        new CustomEvent('apply', {
          detail: {
            originalUrl: fnCtx.state.originalUrl,
            transformationsUrl,
            transformations,
          },
        }),
      )
    },
    'on.cancel': () => {
      fnCtx.remove()

      fnCtx.dispatchEvent(new CustomEvent('cancel'))
    },
  }
}
