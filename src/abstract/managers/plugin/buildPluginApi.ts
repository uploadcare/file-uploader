import type { PubSub } from '../../../lit/PubSubCompat';
import type { SharedState } from '../../../lit/SharedState';
import type { SharedInstancesBag } from '../../../lit/shared-instances';
import type { Uid } from '../../../lit/Uid';
import type { ConfigType } from '../../../types';
import type { UploadcareFile } from '../../../types/exported';
import { UploadSource } from '../../../utils/UploadSource';
import type { CustomConfig } from '../../customConfigOptions';
import { sharedConfigKey } from '../../sharedConfigKey';
import type { ApiAddFileCommonOptions } from '../../UploaderPublicApi';
import { uploadcareFileToEntryData } from '../../uploadEntrySchema';
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
    replace: (internalId: string, file: UploadcareFile, { silent, fileName, source }: ApiAddFileCommonOptions = {}) => {
      const oldId = internalId as Uid;
      const collection = sharedInstancesBag.uploadCollection;
      const index = collection.items().indexOf(oldId);
      const oldEntry = collection.read(oldId);
      if (index === -1 || !oldEntry) {
        throw new Error(`File with internalId ${internalId} not found`);
      }
      // Carry over the original entry's context so the replacement keeps its
      // identity within the session; everything file-specific comes from `file`.
      const preserved = {
        source: oldEntry.getValue('source'),
        metadata: oldEntry.getValue('metadata'),
        fullPath: oldEntry.getValue('fullPath'),
        silent: oldEntry.getValue('silent'),
      };
      collection.remove(oldId);
      const newId = collection.add(
        {
          ...uploadcareFileToEntryData(file),
          fileName: fileName ?? file.originalFilename ?? null,
          silent: silent ?? preserved.silent,
          source: source ?? preserved.source ?? UploadSource.API,
          metadata: preserved.metadata,
          fullPath: preserved.fullPath,
        },
        { index },
      );
      return sharedInstancesBag.api.getOutputItem<'success'>(newId);
    },
  };

  return { registry: registryApi, config: configApi, activity: activityApi, files: filesApi };
}
