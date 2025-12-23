import type { Queue, UploadcareGroup } from '@uploadcare/upload-client';
import type { EditorImageCropper, EditorImageFader, EditorSlider } from '..';
import type { LocaleDefinition } from '../abstract/localeRegistry';
import type { A11y } from '../abstract/managers/a11y';
import type { LocaleManager } from '../abstract/managers/LocaleManager';
import type { ModalManager } from '../abstract/managers/ModalManager';
import type { SecureUploadsManager } from '../abstract/managers/SecureUploadsManager';
import type { TelemetryManager } from '../abstract/managers/TelemetryManager';
import type { ValidationManager } from '../abstract/managers/ValidationManager';
import type { TypedCollection } from '../abstract/TypedCollection';
import type { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import type { UploadEntryData } from '../abstract/uploadEntrySchema';
import type { TabIdValue } from '../blocks/CloudImageEditor/src/toolbar-constants';
import type {
  CropAspectRatio,
  CropPresetList,
  LoadingOperations,
  Transformations,
} from '../blocks/CloudImageEditor/src/types';
import type { EventEmitter } from '../blocks/UploadCtxProvider/EventEmitter';
import type { ConfigType, OutputCollectionState, OutputErrorCollection } from '../types';
import type { LitBlock } from './LitBlock';
import type { Uid } from './Uid';

type SharedConfigState = {
  [K in keyof ConfigType as `*cfg/${K}`]: ConfigType[K];
};

export type BlocksRegistry = Set<LitBlock>;

type ActivityBlockCtxState = {
  '*currentActivity': string | null;
  '*currentActivityParams': Record<string, unknown>;
  '*history': (string | null)[];
  '*historyBack': (() => void) | null;
  '*closeModal': () => void;
};

type UploaderBlockCtxState = ActivityBlockCtxState & {
  '*commonProgress': number;
  '*uploadList': { uid: Uid }[];
  '*uploadQueue': Queue;
  '*collectionErrors': OutputErrorCollection[];
  '*collectionState': OutputCollectionState | null;
  '*groupInfo': UploadcareGroup | null;
  '*uploadTrigger': Set<Uid>;
};

type SolutionBlockCtxState = UploaderBlockCtxState & {
  '*solution': string | null;
};

type CloudImageEditorState = {
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

type EditorImageCropperState = {
  '*padding': number;
  '*operations': { rotate: number; mirror: boolean; flip: boolean };
  '*imageBox': { x: number; y: number; width: number; height: number };
  '*cropBox': { x: number; y: number; width: number; height: number };
};

type EditorToolbarState = {
  '*showListAspectRatio': boolean;
  '*sliderEl': EditorSlider | null;
  '*showSlider': boolean;
  '*currentFilter': string;
  '*currentOperation': string | null;
  '*operationTooltip': string | null;
};

type DynamicBlockState = {
  '*blocksRegistry': BlocksRegistry;
  '*eventEmitter': EventEmitter;
  '*localeManager': LocaleManager;
  '*telemetryManager': TelemetryManager;
  '*a11y': A11y;
  '*modalManager': ModalManager | null;
};

type DynamicUploaderBlockState = {
  '*uploadCollection': TypedCollection<UploadEntryData>;
  '*publicApi': UploaderPublicApi;
  '*validationManager': ValidationManager;
  '*secureUploadsManager': SecureUploadsManager;
};

type LocaleState = {
  [K in keyof LocaleDefinition as `*l10n/${K}`]: string;
};

export type SharedState = SolutionBlockCtxState &
  SharedConfigState &
  CloudImageEditorState &
  EditorImageCropperState &
  EditorToolbarState &
  DynamicBlockState &
  DynamicUploaderBlockState &
  LocaleState;
