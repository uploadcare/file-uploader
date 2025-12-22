import { createCdnUrl, createCdnUrlModifiers } from '../../../utils/cdn-utils';
import { TRANSPARENT_PIXEL_SRC } from '../../../utils/transparentPixelSrc';
import type { CloudImageEditorBlock } from './CloudImageEditorBlock';
import { CROP_PADDING } from './cropper-constants';
import type { EditorImageCropper } from './EditorImageCropper';
import type { EditorImageFader } from './EditorImageFader';
import type { EditorSlider } from './EditorSlider';
import { FAKE_ORIGINAL_FILTER } from './EditorSlider';
import { transformationsToOperations } from './lib/transformationUtils';
import { ALL_TABS, type ColorOperation, TabId } from './toolbar-constants';
import type { ApplyResult, CropPresetList, ImageSize, LoadingOperations, Rectangle, Transformations } from './types';

type TabIdValue = (typeof TabId)[keyof typeof TabId];

export type CloudImageEditorState = {
  '*originalUrl': string | null;
  '*loadingOperations': LoadingOperations;
  '*faderEl': EditorImageFader | null;
  '*cropperEl': EditorImageCropper | null;
  '*imgEl': HTMLImageElement | null;
  '*imgContainerEl': HTMLDivElement | null;
  '*networkProblems': boolean;
  '*imageSize': ImageSize | null;
  '*editorTransformations': Transformations;
  '*cropPresetList': CropPresetList;
  '*currentAspectRatio': CropPresetList[number] | null;
  '*tabList': readonly TabIdValue[];
  '*tabId': TabIdValue;
  '*on.retryNetwork': () => void;
  '*on.apply': (transformations: Transformations) => void;
  '*on.cancel': () => void;
  '*sliderEl': EditorSlider | null;
  '*showSlider': boolean;
  '*showListAspectRatio': boolean;
  '*currentFilter': string;
  '*currentOperation': ColorOperation | null;
  '*operationTooltip': string | null;
  '*operations': {
    rotate: number;
    mirror: boolean;
    flip: boolean;
  };
  '*padding': number;
  '*imageBox': Rectangle;
  '*cropBox': Rectangle;
};

export function createCloudImageEditorState(fnCtx: CloudImageEditorBlock): CloudImageEditorState {
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
    '*tabList': [...ALL_TABS],
    '*tabId': TabId.CROP,
    '*on.retryNetwork': () => {
      const images = fnCtx.querySelectorAll('img');
      for (const img of images) {
        const originalSrc = img.src;
        img.src = TRANSPARENT_PIXEL_SRC;
        img.src = originalSrc;
      }
      fnCtx.editor$['*networkProblems'] = false;
    },
    '*on.apply': (transformations: Transformations) => {
      if (!transformations) {
        return;
      }
      const originalUrl = fnCtx.editor$['*originalUrl'];
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
    '*sliderEl': null,
    '*showSlider': false,
    '*showListAspectRatio': false,
    '*currentFilter': FAKE_ORIGINAL_FILTER,
    '*currentOperation': null,
    '*operationTooltip': null,
    '*operations': {
      rotate: 0,
      mirror: false,
      flip: false,
    },
    '*padding': CROP_PADDING,
    '*imageBox': {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    },
    '*cropBox': {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    },
  };
}
