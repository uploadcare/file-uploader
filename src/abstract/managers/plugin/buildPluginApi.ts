import type { PubSub } from '../../../lit/PubSubCompat';
import type { SharedState } from '../../../lit/SharedState';
import type { SharedInstancesBag } from '../../../lit/shared-instances';
import type { Uid } from '../../../lit/Uid';
import type { ConfigType } from '../../../types';
import type { UploadcareFile } from '../../../types/exported';
import type { CustomConfig } from '../../customConfigOptions';
import { sharedConfigKey } from '../../sharedConfigKey';
import type { PluginRegistry } from './PluginRegistry';
import type {
  PluginActivityApi,
  PluginApi,
  PluginConfigApi,
  PluginFileEntryUpdate,
  PluginFilesApi,
  PluginRegistryApi,
} from './PluginTypes';

export function buildPluginApi(
  registry: PluginRegistry,
  ctx: PubSub<SharedState>,
  sharedInstancesBag: SharedInstancesBag,
  pluginId: string,
  configSubscriptions: (() => void)[],
): PluginApi {
  const registryApi: PluginRegistryApi = {
    registerSource: (source) => registry.addSource(pluginId, source),
    registerActivity: (activity) => registry.addActivity(pluginId, activity),
    registerFileAction: (fileAction) => registry.addFileAction(pluginId, fileAction),
    registerFileHook: (hook) => registry.addFileHook(pluginId, hook),
    registerIcon: (icon) => registry.addIcon(pluginId, icon),
    registerL10n: (l10n) => registry.addL10n(pluginId, l10n),
    registerConfig: (definition) => {
      registry.addConfig(pluginId, definition);
      const stateKey = sharedConfigKey(definition.name as keyof (ConfigType & CustomConfig));
      if (!ctx.has(stateKey as keyof SharedState)) {
        ctx.add(stateKey, definition.defaultValue as unknown as SharedState[typeof stateKey]);
      }
    },
  };

  const configApi: PluginConfigApi = {
    get: <TKey extends keyof (ConfigType & CustomConfig)>(configName: TKey): (ConfigType & CustomConfig)[TKey] => {
      const stateKey = sharedConfigKey(configName);
      return ctx.read(stateKey) as unknown as (ConfigType & CustomConfig)[TKey];
    },

    subscribe: <TKey extends keyof (ConfigType & CustomConfig)>(
      configName: TKey,
      callback: (value: (ConfigType & CustomConfig)[TKey]) => void,
    ): (() => void) => {
      const stateKey = sharedConfigKey(configName);
      const unsub = ctx.sub(stateKey, (value) => {
        callback(value as unknown as (ConfigType & CustomConfig)[TKey]);
      });
      configSubscriptions.push(unsub);
      return unsub;
    },
  };

  const activityApi: PluginActivityApi = {
    getParams: (): Record<string, unknown> => {
      return ctx.read('*currentActivityParams') as Record<string, unknown>;
    },

    subscribeToParams: (callback: (params: Record<string, unknown>) => void): (() => void) => {
      const unsub = ctx.sub('*currentActivityParams', (params) => {
        callback(params as Record<string, unknown>);
      });
      configSubscriptions.push(unsub);
      return unsub;
    },
  };

  const filesApi: PluginFilesApi = {
    update: (internalId: string, changes: PluginFileEntryUpdate) => {
      const entry = sharedInstancesBag.uploadCollection?.read(internalId as Uid);
      if (!entry) return;
      if (changes.file !== undefined) {
        entry.setValue('file', changes.file as File);
        entry.setValue('fileSize', changes.file.size);
      }
      if (changes.cdnUrl !== undefined) entry.setValue('cdnUrl', changes.cdnUrl);
      if (changes.cdnUrlModifiers !== undefined) entry.setValue('cdnUrlModifiers', changes.cdnUrlModifiers);
      if (changes.mimeType !== undefined) entry.setValue('mimeType', changes.mimeType);
    },
    replace: (internalId: string, file: UploadcareFile) => {
      const entry = sharedInstancesBag.uploadCollection?.read(internalId as Uid);
      if (!entry) return;
      // Release the previous file's resources before discarding their references:
      // cancel any in-flight upload and revoke a local blob thumbnail.
      entry.getValue('abortController')?.abort();
      const prevThumbUrl = entry.getValue('thumbUrl');
      if (prevThumbUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(prevThumbUrl);
      }
      entry.setMultipleValues({
        // New file + everything derived from its uuid (mirrors addFileFromUploadcareFile).
        fileInfo: file,
        uuid: file.uuid,
        cdnUrl: file.cdnUrl,
        fileName: file.originalFilename ?? null,
        fileSize: file.size,
        isImage: file.isImage ?? false,
        mimeType: file.contentInfo?.mime?.mime ?? file.mimeType ?? null,
        uploadProgress: 100,
        // Reset state tied to the previous file — the old modifiers, local blob,
        // errors and progress no longer apply to the replacement.
        cdnUrlModifiers: '',
        file: null,
        externalUrl: null,
        thumbUrl: null,
        errors: [],
        uploadError: null,
        isUploading: false,
        isQueuedForUploading: false,
        isValidationPending: false,
        isQueuedForValidation: false,
        isRemoved: false,
        abortController: null,
      });
    },
  };

  return { registry: registryApi, config: configApi, activity: activityApi, files: filesApi };
}
