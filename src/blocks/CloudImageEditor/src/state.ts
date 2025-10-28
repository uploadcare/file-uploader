import { createCdnUrl, createCdnUrlModifiers } from '../../../utils/cdn-utils';
import { serializeCsv } from '../../../utils/comma-separated';
import { TRANSPARENT_PIXEL_SRC } from '../../../utils/transparentPixelSrc';
import type { CloudImageEditorBlock } from './CloudImageEditorBlock';
import { transformationsToOperations } from './lib/transformationUtils';
import { ALL_TABS, TabId } from './toolbar-constants';
import type { ApplyResult, Transformations } from './types';

export function initState(fnCtx: CloudImageEditorBlock) {
  return {
    '*originalUrl': null,
    '*faderEl': null,
    '*cropperEl': null,
    '*imgEl': null,
    '*imgContainerEl': null,
    '*networkProblems': false,
    '*imageSize': null,
    '*editorTransformations': {},
    '*cropPresetList': [],
    '*currentAspectRatio': null,
    '*tabList': ALL_TABS,
    '*tabId': TabId.CROP,

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
    cdnUrl: null,
    cropPreset: '',
    tabs: serializeCsv([...ALL_TABS]),

    'presence.networkProblems': false,
    'presence.modalCaption': true,
    'presence.editorToolbar': false,
    'presence.viewerToolbar': true,
    // TODO: beware of wrong ctx in case of element re-creation:
    '*on.retryNetwork': () => {
      const images = fnCtx.querySelectorAll('img');
      for (const img of images) {
        const originalSrc = img.src;
        img.src = TRANSPARENT_PIXEL_SRC;
        img.src = originalSrc;
      }
      fnCtx.$['*networkProblems'] = false;
    },
    '*on.apply': (transformations: Transformations) => {
      if (!transformations) {
        return;
      }
      const originalUrl = fnCtx.$['*originalUrl'];
      const cdnUrlModifiers = createCdnUrlModifiers(transformationsToOperations(transformations), 'preview');
      const cdnUrl = createCdnUrl(originalUrl, cdnUrlModifiers);

      const eventData: ApplyResult = {
        originalUrl,
        cdnUrlModifiers,
        cdnUrl,
        transformations,
      };
      fnCtx.dispatchEvent(
        new CustomEvent('apply', {
          detail: eventData,
          bubbles: true,
          composed: true,
        }),
      );
      fnCtx.remove();
    },
    '*on.cancel': () => {
      fnCtx.remove();

      fnCtx.dispatchEvent(
        new CustomEvent('cancel', {
          bubbles: true,
          composed: true,
        }),
      );
    },
  };
}
