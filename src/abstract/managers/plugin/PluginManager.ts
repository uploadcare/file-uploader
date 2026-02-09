import { SharedInstance, type SharedInstancesBag } from '../../../lit/shared-instances';
import { sharedConfigKey } from '../../sharedConfigKey';
import type {
  Owned,
  PluginApi,
  PluginExports,
  PluginRegistryApi,
  PluginRegistrySnapshot,
  UploaderPlugin,
} from './PluginTypes';

export class PluginManager extends SharedInstance {
  private _plugins: Map<string, RegisteredPlugin> = new Map();
  private _sources: Owned<PluginSourceRegistration>[] = [];
  private _activities: Owned<PluginActivityRegistration>[] = [];
  private _slots: Owned<PluginSlotRegistration>[] = [];
  private _icons: Owned<PluginIconRegistration>[] = [];
  private _i18n: Owned<PluginI18nRegistration>[] = [];
  private _subscribers: Set<() => void> = new Set();
  private _pluginsUpdate: Promise<void> = Promise.resolve();

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
      slots: [],
      icons: [],
      i18n: [],
    };

    const registryApi: PluginRegistryApi = {
      registerSource: (source) => this._register(this._sources, registrations.sources, plugin.id, source),
      registerActivity: (activity) => this._register(this._activities, registrations.activities, plugin.id, activity),
      registerSlot: (slot) => this._register(this._slots, registrations.slots, plugin.id, slot),
      registerIcon: (icon) => this._register(this._icons, registrations.icons, plugin.id, icon),
      registerI18n: (i18n) => this._register(this._i18n, registrations.i18n, plugin.id, i18n),
    };

    const pluginApi: PluginApi = {
      registry: registryApi,
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
    });

    this._notifySubscribers();
  }

  private _unregisterPlugin(pluginId: string): void {
    const registered = this._plugins.get(pluginId);
    if (!registered) {
      return;
    }

    this._purgeRegistrations(pluginId);

    registered.exports?.dispose?.();
    this._plugins.delete(pluginId);

    this._notifySubscribers();
  }

  public snapshot(): PluginRegistrySnapshot {
    return {
      sources: [...this._sources],
      activities: [...this._activities],
      slots: [...this._slots],
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
    this._slots = this._slots.filter((item) => item.pluginId !== pluginId);
    this._icons = this._icons.filter((item) => item.pluginId !== pluginId);
    this._i18n = this._i18n.filter((item) => item.pluginId !== pluginId);
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
type PluginSlotRegistration = PluginRegistrySnapshot['slots'][number];
type PluginIconRegistration = PluginRegistrySnapshot['icons'][number];
type PluginI18nRegistration = PluginRegistrySnapshot['i18n'][number];

type RegisteredPlugin = {
  plugin: UploaderPlugin;
  exports?: PluginExports;
  registrations: PluginRegistrySnapshot;
};
