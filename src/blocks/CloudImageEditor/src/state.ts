import { CROP_PADDING } from './cropper-constants';
import type { EditorImageCropper } from './EditorImageCropper';
import type { EditorImageFader } from './EditorImageFader';
import type { EditorSlider } from './EditorSlider';
import { FAKE_ORIGINAL_FILTER } from './EditorSlider';
import { ALL_TABS, type ColorOperation, TabId } from './toolbar-constants';
import type { CropPresetList, ImageSize, LoadingOperations, Rectangle, Transformations } from './types';

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

export function createCloudImageEditorState(): CloudImageEditorState {
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
