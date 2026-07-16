import type { UploadcareGroup } from '@uploadcare/upload-client';
import type { ClipboardController } from '../abstract/controllers/ClipboardController';
import type { RouterController } from '../abstract/controllers/RouterController';
import type { SecureUploadsController } from '../abstract/controllers/SecureUploadsController';
import type { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import type { UploadController } from '../abstract/controllers/UploadController';
import type { UploadEventsController } from '../abstract/controllers/UploadEventsController';
import type { ValidationController } from '../abstract/controllers/ValidationController';
import type { LocaleDefinition } from '../abstract/localeRegistry';
import type { A11y } from '../abstract/managers/a11y';
import type { LocaleManager } from '../abstract/managers/LocaleManager';
import type { PluginController } from '../abstract/managers/plugin';
import type { LazyPluginEntry } from '../abstract/managers/plugin/LazyPluginLoader';
import type { TelemetryManager } from '../abstract/managers/TelemetryManager';
import type { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import type { EventEmitter } from '../blocks/UploadCtxProvider/EventEmitter';
import type { ConfigType, CustomConfig, OutputCollectionState, OutputErrorCollection } from '../types';
import type { LitBlock } from './LitBlock';
import type { ISharedInstance } from './shared-instances';
import type { Uid } from './Uid';

type SharedConfigState = {
  [K in keyof ConfigType as `*cfg/${K}`]: ConfigType[K];
};

type SharedCustomConfigState = {
  [K in keyof CustomConfig as `*cfg/${K}`]: CustomConfig[K];
};

export type BlocksRegistry = Set<LitBlock>;

type UploaderBlockCtxState = {
  '*commonProgress': number;
  '*uploadList': { uid: Uid }[];
  '*collectionErrors': OutputErrorCollection[];
  '*collectionState': OutputCollectionState | null;
  '*groupInfo': UploadcareGroup | null;
  '*uploadTrigger': Set<Uid>;
};

type SolutionBlockCtxState = UploaderBlockCtxState & {
  '*lazyPlugins': LazyPluginEntry[] | null;
};

type SharedContextInstances = Map<string, ISharedInstance>;

type DynamicBlockState = {
  '*sharedContextInstances': SharedContextInstances;
  '*blocksRegistry': BlocksRegistry;
  '*eventEmitter': EventEmitter;
  '*localeManager': LocaleManager;
  '*telemetryManager': TelemetryManager;
  '*a11y': A11y;
  '*router': RouterController;
  '*clipboard': ClipboardController;
  '*pluginManager': PluginController;
};

type DynamicUploaderBlockState = {
  '*uploadCollection': UploadCollectionController;
  '*publicApi': UploaderPublicApi;
  '*validationManager': ValidationController;
  '*secureUploadsManager': SecureUploadsController;
  '*uploadController': UploadController;
  '*uploadEvents': UploadEventsController;
};

type LocaleState = {
  [K in keyof LocaleDefinition as `*l10n/${K}`]: string;
};

export type SharedState = SolutionBlockCtxState &
  SharedConfigState &
  SharedCustomConfigState &
  DynamicBlockState &
  DynamicUploaderBlockState &
  LocaleState;
