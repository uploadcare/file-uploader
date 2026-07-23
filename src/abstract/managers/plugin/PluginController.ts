import { fileIsImage } from '../../../utils/fileTypes';
import { controllerLogger } from '../../controllerLogger';
import { ConfigController } from '../../controllers/ConfigController';
import { containerOf } from '../../di/ControllerContainer';
import { Disposables } from '../../di/Disposables';
import type { UploadEntryTypedData } from '../../uploadEntrySchema';
import { PluginRegistry } from './PluginRegistry';
import type { PluginApi, PluginRegistrySnapshot, PluginUploaderApi, UploaderPlugin } from './PluginTypes';

type Unsubscribe = () => void;

export type PluginControllerDeps = {
  /** Build the per-plugin public `PluginApi` (config/activity/files bridged to the host). */
  buildApi: (registry: PluginRegistry, pluginId: string, configSubscriptions: Unsubscribe[]) => PluginApi;
  /** The public uploader API passed to each plugin's `setup`. */
  getUploaderApi: () => PluginUploaderApi;
  /**
   * Subscribe to the resolved plugin list (user `cfg.plugins` + lazy plugins).
   * Each emission is a promise of the plugins to sync to. Returns a teardown.
   */
  watchPlugins: (onCompute: (pluginsPromise: Promise<UploaderPlugin[] | undefined>) => void) => Unsubscribe;
};

type RegisteredPlugin = {
  plugin: UploaderPlugin;
  dispose?: Unsubscribe;
  configSubscriptions: Unsubscribe[];
};

/**
 * DOM-free plugin engine. Owns the {@link PluginRegistry}, runs the
 * install/uninstall lifecycle (dedup, error isolation, dispose +
 * config-subscription cleanup), and the `onAdd` hook chain. Its DOM/uploader
 * couplings are injected: `buildApi` (wraps `buildPluginApi`), `getUploaderApi`,
 * and `watchPlugins` (wraps `LazyPluginLoader`) — so it constructs without a
 * DOM and is unit testable. Consumers reach it via `container.get(PluginController)`
 * / the `@inject(() => PluginController)` thunk.
 */
export class PluginController {
  // Per-ctx logger: `warn`/`error` always print, prefixed with THIS ctx's name
  // (resolved lazily at log time via the container that built this instance).
  private readonly _log = controllerLogger(this, 'plugin-manager');
  private _deps: PluginControllerDeps;
  private _isDestroyed = false;
  private _plugins: Map<string, RegisteredPlugin> = new Map();
  private _subscribers: Set<Unsubscribe> = new Set();
  private _pluginsUpdate: Promise<void> = Promise.resolve();
  readonly #disposables = new Disposables();
  public readonly registry = new PluginRegistry(() => this._notifySubscribers());

  // Purge a plugin's registrations AND drop the config descriptors it registered
  // on the ctx's `ConfigController` (the single source of truth for config now —
  // there is no separate plugin config registry). `getOrNull` stays tolerant of a
  // ctx without a resolvable ConfigController.
  private _purgePlugin(pluginId: string): void {
    this.registry.purge(pluginId);
    containerOf(this)?.getOrNull(ConfigController)?.unregisterByOwner(pluginId);
  }

  public constructor(deps: PluginControllerDeps) {
    this._deps = deps;

    this.#disposables.add(
      deps.watchPlugins((pluginsPromise) => {
        this._pluginsUpdate = this._pluginsUpdate
          .then(() => pluginsPromise)
          .then((plugins) => {
            // Skip once destroyed so a queued emission can't re-register on a dead controller.
            if (this._isDestroyed || !plugins) return;
            return this._syncPlugins(plugins);
          })
          // Recover the queue: a rejected emission must not permanently poison the
          // chain so later emissions never run. (`_pluginsUpdate` always resolves.)
          .catch((error) => {
            this._log.error('Failed to sync plugins', error);
          });
      }),
    );
  }

  public pluginsReady(): Promise<void> {
    return this._pluginsUpdate;
  }

  public onPluginsChange(callback: Unsubscribe): Unsubscribe {
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
        this._log.warn('A plugin is missing the required "id" field, skipping');
        continue;
      }

      if (processedIds.has(plugin.id)) {
        this._log.warn(`Plugin "${plugin.id}" is already in the list, skipping duplicate`);
        continue;
      }
      processedIds.add(plugin.id);

      if (!this._plugins.has(plugin.id)) {
        try {
          await this._registerPlugin(plugin);
        } catch (error) {
          this._purgePlugin(plugin.id);
          this._notifySubscribers();
          this._log.error(`Plugin "${plugin.id}" setup() threw an error`, error);
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

    const configSubscriptions: Unsubscribe[] = [];
    const pluginApi = this._deps.buildApi(this.registry, plugin.id, configSubscriptions);

    const uploaderApi = this._deps.getUploaderApi();
    // A logger scoped to this plugin — `[uc][<ctx-name>][plugin:<id>]`, verbose
    // tier gated by the uploader's `debug` config. Handed to `setup` so plugins
    // log through the centralized logger with attribution for free.
    const pluginLogger = controllerLogger(this, `plugin:${plugin.id}`);
    let pluginDispose: Unsubscribe | undefined;
    try {
      pluginDispose = (await plugin.setup({ pluginApi, uploaderApi, logger: pluginLogger })) ?? undefined;
    } catch (error) {
      for (const unsub of configSubscriptions) {
        try {
          unsub();
        } catch (e) {
          this._log.warn('Failed to unsubscribe config listener', e);
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

    this._purgePlugin(pluginId);

    for (const unsub of registered.configSubscriptions) {
      try {
        unsub();
      } catch (error) {
        this._log.warn('Failed to unsubscribe config listener', error);
      }
    }

    try {
      registered.dispose?.();
    } catch (error) {
      this._log.warn('Failed to dispose plugin', error);
    }
    this._plugins.delete(pluginId);
    this._notifySubscribers();
  }

  public snapshot(): PluginRegistrySnapshot {
    return this.registry.snapshot();
  }

  public async runOnAddHooks(entry: UploadEntryTypedData): Promise<void> {
    const initialFile = entry.get('file');
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
        this._log.warn(`File hook "onAdd" from plugin "${hook.pluginId}" failed`, error);
      }
    }

    if (file !== initialFile) {
      entry.set('file', file as File);
      entry.set('fileSize', file.size);
      entry.set('mimeType', file.type || null);
      entry.set('isImage', fileIsImage(file));
      if (file instanceof File) {
        entry.set('fileName', file.name);
      }
    }
  }

  public destroy(): void {
    this._isDestroyed = true;
    // Stop new emissions first so a queued sync can't re-register on a dead
    // controller (`#disposables` holds only the `watchPlugins` teardown).
    this.#disposables.run();
    for (const pluginId of Array.from(this._plugins.keys())) {
      this._unregisterPlugin(pluginId);
    }
    this.registry.destroy();
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
