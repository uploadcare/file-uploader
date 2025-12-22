import type { Queue, UploadcareGroup } from '@uploadcare/upload-client';
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
  DynamicBlockState &
  DynamicUploaderBlockState &
  LocaleState;
