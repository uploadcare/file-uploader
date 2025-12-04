import { createCdnUrl, createCdnUrlModifiers } from '../../../utils/cdn-utils';
import { TRANSPARENT_PIXEL_SRC } from '../../../utils/transparentPixelSrc';
import type { CloudImageEditorBlock } from './CloudImageEditorBlock';
import { transformationsToOperations } from './lib/transformationUtils';
import { ALL_TABS, TabId } from './toolbar-constants';
import type { ApplyResult, LoadingOperations, Transformations } from './types';

export function initState(fnCtx: CloudImageEditorBlock) {
  return {
    '*originalUrl': null,
    '*loadingOperations': new Map() as LoadingOperations,
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
