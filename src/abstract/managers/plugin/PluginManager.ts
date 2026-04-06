import type { Unsubscriber } from '../../../lit/PubSubCompat';
import { SharedInstance, type SharedInstancesBag } from '../../../lit/shared-instances';
import { fileIsImage } from '../../../utils/fileTypes';
import type { UploadEntryTypedData } from '../../uploadEntrySchema';
import { buildPluginApi } from './buildPluginApi';
import { LazyPluginLoader } from './LazyPluginLoader';
import { PluginRegistry } from './PluginRegistry';
import type { PluginRegistrySnapshot, UploaderPlugin } from './PluginTypes';

export class PluginManager extends SharedInstance {
  private _plugins: Map<string, RegisteredPlugin> = new Map();
  private _subscribers: Set<Unsubscriber> = new Set();
  private _pluginsUpdate: Promise<void> = Promise.resolve();
  private _lazyPluginLoader: LazyPluginLoader;
  public readonly registry = new PluginRegistry();

  public get configRegistry() {
    return this.registry.config;
  }

  public constructor(sharedInstancesBag: SharedInstancesBag) {
    super(sharedInstancesBag);

    this._lazyPluginLoader = new LazyPluginLoader(this._ctx, (pluginsPromise) => {
      this._pluginsUpdate = this._pluginsUpdate
        .then(() => pluginsPromise)
        .then((plugins) => {
          if (plugins) {
            return this._syncPlugins(plugins);
          }
          return;
        });
    });
  }

  public pluginsReady(): Promise<void> {
    return this._pluginsUpdate;
  }

  public onPluginsChange(callback: Unsubscriber): Unsubscriber {
    this._subscribers.add(callback);
    return () => {
      this._subscribers.delete(callback);
    };
  }

  private async _syncPlugins(plugins: UploaderPlugin[]): Promise<void> {
    const currentPluginIds = new Set(this._plugins.keys());
    const processedIds = new Set<string>();

    for (const plugin of plugins) {
      if (!plugin.id) {
        console.warn('[PluginManager] A plugin is missing the required "id" field, skipping');
        continue;
      }

      if (processedIds.has(plugin.id)) {
        console.warn(`[PluginManager] Plugin "${plugin.id}" is already in the list, skipping duplicate`);
        continue;
      }
      processedIds.add(plugin.id);

      if (!this._plugins.has(plugin.id)) {
        try {
          await this._registerPlugin(plugin);
        } catch (error) {
          this.registry.purge(plugin.id);
          this._notifySubscribers();
          console.error(`[PluginManager] Plugin "${plugin.id}" setup() threw an error`, error);
        }
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

    const configSubscriptions: Unsubscriber[] = [];
    const pluginApi = buildPluginApi(
      this.registry,
      this._ctx,
      this._sharedInstancesBag,
      plugin.id,
      configSubscriptions,
    );

    const uploaderApi = this._sharedInstancesBag.api;
    let pluginDispose: Unsubscriber | undefined;
    try {
      pluginDispose = (await plugin.setup({ pluginApi, uploaderApi })) ?? undefined;
    } catch (error) {
      for (const unsub of configSubscriptions) {
        try {
          unsub();
        } catch (e) {
          this._debugPrint('Failed to unsubscribe config listener', e);
        }
      }
      throw error;
    }

    this._plugins.set(plugin.id, { plugin, dispose: pluginDispose, configSubscriptions });
    this._notifySubscribers();
  }

  private _unregisterPlugin(pluginId: string): void {
    const registered = this._plugins.get(pluginId);
    if (!registered) return;

    this.registry.purge(pluginId);

    for (const unsub of registered.configSubscriptions) {
      try {
        unsub();
      } catch (error) {
        this._debugPrint('Failed to unsubscribe config listener', error);
      }
    }

    registered.dispose?.();
    this._plugins.delete(pluginId);
    this._notifySubscribers();
  }

  public snapshot(): PluginRegistrySnapshot {
    return this.registry.snapshot();
  }

  public async runOnAddHooks(entry: UploadEntryTypedData): Promise<void> {
    const initialFile = entry.getValue('file');
    if (!initialFile) return;

    const onAddHooks = this.registry.snapshot().fileHooks.filter((h) => h.type === 'onAdd');
    if (onAddHooks.length === 0) return;

    let file: File | Blob = initialFile;
    const abortController = new AbortController();
    for (const hook of onAddHooks) {
      if (abortController.signal.aborted) break;
      try {
        const hookPromise = hook.handler({ file, signal: abortController.signal });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`onAdd hook timed out`)), hook.timeout),
        );
        ({ file } = await Promise.race([hookPromise, timeoutPromise]));
      } catch (error) {
        console.warn(`File hook "onAdd" from plugin "${hook.pluginId}" failed`, error);
      }
    }

    if (file !== initialFile) {
      entry.setValue('file', file as File);
      entry.setValue('fileSize', file.size);
      entry.setValue('mimeType', file.type || null);
      entry.setValue('isImage', fileIsImage(file));
      if (file instanceof File) {
        entry.setValue('fileName', file.name);
      }
    }
  }

  public override destroy(): void {
    for (const pluginId of Array.from(this._plugins.keys())) {
      this._unregisterPlugin(pluginId);
    }
    this._lazyPluginLoader.destroy();
    super.destroy();
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

type RegisteredPlugin = {
  plugin: UploaderPlugin;
  dispose?: Unsubscriber;
  configSubscriptions: Unsubscriber[];
};
