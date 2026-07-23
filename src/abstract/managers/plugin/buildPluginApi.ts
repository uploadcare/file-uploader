import type { Uid } from '../../../lit/Uid';
import type { ConfigType } from '../../../types';
import type { ConfigController } from '../../controllers/ConfigController';
import { RouterController } from '../../controllers/RouterController';
import { UploadCollectionController } from '../../controllers/UploadCollectionController';
import type { CustomConfig } from '../../customConfigOptions';
import type { ControllerContainer } from '../../di/ControllerContainer';
import type { PluginRegistry } from './PluginRegistry';
import type {
  PluginActivityApi,
  PluginApi,
  PluginConfigApi,
  PluginFileEntryUpdate,
  PluginFilesApi,
  PluginRegistryApi,
  PluginRouterApi,
} from './PluginTypes';

export function buildPluginApi(
  registry: PluginRegistry,
  config: ConfigController,
  container: ControllerContainer,
  pluginId: string,
  configSubscriptions: (() => void)[],
): PluginApi {
  // Router/collection resolved off the per-ctx container.
  const router = container.get(RouterController);
  const registryApi: PluginRegistryApi = {
    registerSource: (source) => registry.addSource(pluginId, source),
    registerActivity: (activity) => registry.addActivity(pluginId, activity),
    registerFileAction: (fileAction) => registry.addFileAction(pluginId, fileAction),
    registerFileHook: (hook) => registry.addFileHook(pluginId, hook),
    registerIcon: (icon) => registry.addIcon(pluginId, icon),
    registerL10n: (l10n) => registry.addL10n(pluginId, l10n),
    registerConfig: (definition) => {
      registry.addConfig(pluginId, definition);
      // Register the FULL descriptor on the ctx's `ConfigController` (the single
      // source of truth for config descriptors) — off the `*cfg/*` facade, and
      // no longer a partial name+default. `register` is idempotent + keeps any
      // value written before the plugin registered (first-write-wins). Owned by
      // `pluginId` so the descriptor is dropped if the plugin is ever removed.
      if (!config.hasKey(definition.name)) {
        config.register(definition, pluginId);
      }
    },
  };

  const configApi: PluginConfigApi = {
    get: <TKey extends keyof (ConfigType & CustomConfig)>(configName: TKey): (ConfigType & CustomConfig)[TKey] => {
      return config.getCustom(configName);
    },

    subscribe: <TKey extends keyof (ConfigType & CustomConfig)>(
      configName: TKey,
      callback: (value: (ConfigType & CustomConfig)[TKey]) => void,
    ): (() => void) => {
      // Immediate fire + per-key `Object.is` dedup via the atomic `observeCustom`
      // — the same semantics the `ctx.sub('*cfg/<name>', …)` facade gave.
      const unsub = config.observeCustom<(ConfigType & CustomConfig)[TKey]>(configName, callback, {
        immediate: true,
      });
      configSubscriptions.push(unsub);
      return unsub;
    },
  };

  const activityApi: PluginActivityApi = {
    getParams: (): Record<string, unknown> => {
      return router.params as Record<string, unknown>;
    },

    subscribeToParams: (callback: (params: Record<string, unknown>) => void): (() => void) => {
      let last = router.params;
      // Fire immediately with the current params (matches v1's `ctx.sub`).
      callback(last as Record<string, unknown>);
      const unsub = router.subscribe(() => {
        if (router.params !== last) {
          last = router.params;
          callback(router.params as Record<string, unknown>);
        }
      });
      configSubscriptions.push(unsub);
      return unsub;
    },
  };

  const filesApi: PluginFilesApi = {
    update: (internalId: string, changes: PluginFileEntryUpdate) => {
      const entry = container.getOrNull(UploadCollectionController)?.read(internalId as Uid);
      if (!entry) return;
      if (changes.file !== undefined) {
        entry.set('file', changes.file as File);
        entry.set('fileSize', changes.file.size);
      }
      if (changes.cdnUrl !== undefined) entry.set('cdnUrl', changes.cdnUrl);
      if (changes.cdnUrlModifiers !== undefined) entry.set('cdnUrlModifiers', changes.cdnUrlModifiers);
      if (changes.mimeType !== undefined) entry.set('mimeType', changes.mimeType);
    },
  };

  const routerApi: PluginRouterApi = {
    traverse: (edge) => router.traverse(edge),
  };

  return { registry: registryApi, config: configApi, activity: activityApi, files: filesApi, router: routerApi };
}
