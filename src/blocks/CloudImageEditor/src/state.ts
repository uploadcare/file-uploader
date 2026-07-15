import { createCdnUrl, createCdnUrlModifiers } from '../../../utils/cdn-utils';
import { TRANSPARENT_PIXEL_SRC } from '../../../utils/transparentPixelSrc';
import type { CloudImageEditorBlock } from './CloudImageEditorBlock';
import type { EditorImageCropper } from './EditorImageCropper';
import type { EditorImageFader } from './EditorImageFader';
import type { EditorSlider } from './EditorSlider';
import { transformationsToOperations } from './lib/transformationUtils';
import type { TabIdValue } from './toolbar-constants';
import { ALL_TABS, TabId } from './toolbar-constants';
import type { ApplyResult, CropAspectRatio, CropPresetList, LoadingOperations, Transformations } from './types';

/**
 * State for the top-level cloud image editor block.
 */
type CloudImageEditorBlockState = {
  '*originalUrl': string | null;
  '*loadingOperations': LoadingOperations;
  '*faderEl': EditorImageFader | null;
  '*cropperEl': EditorImageCropper | null;
  '*imgEl': HTMLImageElement | null;
  '*imgContainerEl': HTMLElement | null;
  '*networkProblems': boolean;
  '*imageSize': { width: number; height: number } | null;
  '*editorTransformations': Transformations;
  '*cropPresetList': CropPresetList;
  '*currentAspectRatio': CropAspectRatio | null;
  '*tabList': readonly TabIdValue[];
  '*tabId': TabIdValue;
  '*on.retryNetwork': () => void;
  '*on.apply': (transformations: Transformations) => void;
  '*on.cancel': () => void;
};

/**
 * State for the image cropper sub-block.
 */
type EditorImageCropperState = {
  '*padding': number;
  '*operations': { rotate: number; mirror: boolean; flip: boolean };
  '*imageBox': { x: number; y: number; width: number; height: number };
  '*cropBox': { x: number; y: number; width: number; height: number };
};

/**
 * State for the editor toolbar sub-block.
 */
type EditorToolbarState = {
  '*showListAspectRatio': boolean;
  '*sliderEl': EditorSlider | null;
  '*showSlider': boolean;
  '*currentFilter': string;
  '*currentOperation': string | null;
  '*operationTooltip': string | null;
};

/**
 * Full set of ctx keys owned by the cloud image editor and its sub-blocks
 * (cropper, toolbar). Still lives in the shared uploader ctx (`SharedState`)
 * — this is a type-only relocation, not a new state container.
 */
export type CloudImageEditorState = CloudImageEditorBlockState & EditorImageCropperState & EditorToolbarState;

export function createCloudImageEditorState(fnCtx: CloudImageEditorBlock) {
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
      if (!originalUrl) {
        console.warn('Original URL is null, cannot apply transformations');
        return;
      }
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
