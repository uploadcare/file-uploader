import { SharedInstance, type SharedInstancesBag } from '../../../lit/shared-instances';
import { type CustomConfigDefinition, CustomConfigRegistry } from '../../customConfigOptions';
import { sharedConfigKey } from '../../sharedConfigKey';
import type {
  Owned,
  PluginActivityApi,
  PluginApi,
  PluginConfigApi,
  PluginExports,
  PluginFileActionRegistration,
  PluginRegistryApi,
  PluginRegistrySnapshot,
  UploaderPlugin,
} from './PluginTypes';

export class PluginManager extends SharedInstance {
  private _plugins: Map<string, RegisteredPlugin> = new Map();
  private _sources: Owned<PluginSourceRegistration>[] = [];
  private _activities: Owned<PluginActivityRegistration>[] = [];
  private _fileActions: Owned<PluginFileActionRegistration>[] = [];
  private _icons: Owned<PluginIconRegistration>[] = [];
  private _i18n: Owned<PluginI18nRegistration>[] = [];
  private _subscribers: Set<() => void> = new Set();
  private _pluginsUpdate: Promise<void> = Promise.resolve();
  public readonly configRegistry = new CustomConfigRegistry();

  public constructor(sharedInstancesBag: SharedInstancesBag) {
    super(sharedInstancesBag);

    this.addSub(
      this._ctx.sub(sharedConfigKey('plugins'), (plugins) => {
        this._pluginsUpdate = this._pluginsUpdate
          .then(() => this._syncPlugins(plugins))
          .catch((error) => {
            this._debugPrint('Plugin sync failed', error);
          });
      }),
    );
  }

  public onPluginsChange(callback: () => void): () => void {
    this._subscribers.add(callback);
    return () => {
      this._subscribers.delete(callback);
    };
  }

  private async _syncPlugins(plugins: UploaderPlugin[]): Promise<void> {
    const currentPluginIds = new Set(this._plugins.keys());

    for (const plugin of plugins) {
      if (!this._plugins.has(plugin.id)) {
        await this._registerPlugin(plugin);
      }
      currentPluginIds.delete(plugin.id);
    }

    for (const pluginId of currentPluginIds) {
      this._unregisterPlugin(pluginId);
    }
  }

  private async _registerPlugin(plugin: UploaderPlugin): Promise<void> {
    if (this._plugins.has(plugin.id)) {
      this._unregisterPlugin(plugin.id);
    }

    const registrations: PluginRegistrySnapshot = {
      sources: [],
      activities: [],
      fileActions: [],
      icons: [],
      i18n: [],
    };

    // Track config subscriptions for automatic cleanup
    const configSubscriptions: Array<() => void> = [];

    const registryApi: PluginRegistryApi = {
      registerSource: (source) => this._register(this._sources, registrations.sources, plugin.id, source),
      registerActivity: (activity) => this._register(this._activities, registrations.activities, plugin.id, activity),
      registerFileAction: (fileAction) =>
        this._register(this._fileActions, registrations.fileActions, plugin.id, fileAction),
      registerIcon: (icon) => this._register(this._icons, registrations.icons, plugin.id, icon),
      registerI18n: (i18n) => this._register(this._i18n, registrations.i18n, plugin.id, i18n),
      registerConfig: (definition) => {
        this.configRegistry.register(plugin.id, definition as CustomConfigDefinition);
      },
    };

    const configApi: PluginConfigApi = {
      get: <T = unknown>(configName: string): T => {
        // Custom config names are dynamic and not known at compile time
        // biome-ignore lint/suspicious/noExplicitAny: Custom config keys are dynamic
        const stateKey = sharedConfigKey(configName as any);
        // @ts-expect-error - Custom config state keys are not in the static type
        return this._ctx.read(stateKey) as T;
      },

      subscribe: <T = unknown>(configName: string, callback: (value: T) => void): (() => void) => {
        // Custom config names are dynamic and not known at compile time
        // biome-ignore lint/suspicious/noExplicitAny: Custom config keys are dynamic
        const stateKey = sharedConfigKey(configName as any);
        // @ts-expect-error - Custom config state keys are not in the static type
        const unsub = this._ctx.sub(stateKey, (value) => {
          callback(value as T);
        });

        // Track subscription for automatic cleanup
        configSubscriptions.push(unsub);

        return unsub;
      },
    };

    const activityApi: PluginActivityApi = {
      getParams: (): Record<string, unknown> => {
        return this._ctx.read('*currentActivityParams') as Record<string, unknown>;
      },

      subscribeToParams: (callback: (params: Record<string, unknown>) => void): (() => void) => {
        const unsub = this._ctx.sub('*currentActivityParams', (params) => {
          callback(params as Record<string, unknown>);
        });

        // Track subscription for automatic cleanup
        configSubscriptions.push(unsub);

        return unsub;
      },
    };

    const pluginApi: PluginApi = {
      registry: registryApi,
      config: configApi,
      activity: activityApi,
    };

    const uploaderApi = this._sharedInstancesBag.api;
    let pluginExports: PluginExports | undefined;

    try {
      pluginExports = (await plugin.setup({ pluginApi, uploaderApi })) ?? undefined;
    } catch (error) {
      this._purgeRegistrations(plugin.id);
      throw error;
    }

    this._plugins.set(plugin.id, {
      plugin,
      exports: pluginExports,
      registrations,
      configSubscriptions,
    });

    this._notifySubscribers();
  }

  private _unregisterPlugin(pluginId: string): void {
    const registered = this._plugins.get(pluginId);
    if (!registered) {
      return;
    }

    this._purgeRegistrations(pluginId);

    // Clean up config subscriptions
    for (const unsub of registered.configSubscriptions) {
      try {
        unsub();
      } catch (error) {
        this._debugPrint('Failed to unsubscribe config listener', error);
      }
    }

    registered.exports?.dispose?.();
    this._plugins.delete(pluginId);

    this._notifySubscribers();
  }

  public snapshot(): PluginRegistrySnapshot {
    return {
      sources: [...this._sources],
      activities: [...this._activities],
      fileActions: [...this._fileActions],
      icons: [...this._icons],
      i18n: [...this._i18n],
    };
  }

  public override destroy(): void {
    for (const pluginId of Array.from(this._plugins.keys())) {
      this._unregisterPlugin(pluginId);
    }
    super.destroy();
  }

  private _register<T>(target: Owned<T>[], bucket: Owned<T>[], pluginId: string, registration: T): T {
    const owned = { ...registration, pluginId } as Owned<T>;
    target.push(owned);
    bucket.push(owned);
    return registration;
  }

  private _purgeRegistrations(pluginId: string): void {
    this._sources = this._sources.filter((item) => item.pluginId !== pluginId);
    this._activities = this._activities.filter((item) => item.pluginId !== pluginId);
    this._fileActions = this._fileActions.filter((item) => item.pluginId !== pluginId);
    this._icons = this._icons.filter((item) => item.pluginId !== pluginId);
    this._i18n = this._i18n.filter((item) => item.pluginId !== pluginId);
    this.configRegistry.unregisterByPlugin(pluginId);
  }

  private _notifySubscribers(): void {
    for (const callback of this._subscribers) {
      try {
        callback();
      } catch {
        // Ignore subscriber errors
      }
    }
  }
}

type PluginSourceRegistration = PluginRegistrySnapshot['sources'][number];
type PluginActivityRegistration = PluginRegistrySnapshot['activities'][number];
type PluginIconRegistration = PluginRegistrySnapshot['icons'][number];
type PluginI18nRegistration = PluginRegistrySnapshot['i18n'][number];

type RegisteredPlugin = {
  plugin: UploaderPlugin;
  exports?: PluginExports;
  registrations: PluginRegistrySnapshot;
  configSubscriptions: Array<() => void>;
};
