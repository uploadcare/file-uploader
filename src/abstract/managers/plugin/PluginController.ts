import { fileDerivedFields } from '../../../utils/fileTypes';
import { controllerLogger } from '../../controllerLogger';
import { ConfigController } from '../../controllers/ConfigController';
import { containerOf, lifetimeOf } from '../../di/ControllerContainer';
import { Disposables } from '../../di/Disposables';
import { Listeners } from '../../host-subscription';
import type { Logger } from '../../logger';
import type { UploadEntryTypedData } from '../../uploadEntrySchema';
import { PluginRegistry } from './PluginRegistry';
import type { PluginApi, PluginRegistrySnapshot, PluginUploaderApi, UploaderPlugin } from './PluginTypes';
import { runFileHook } from './runFileHook';

type Unsubscribe = () => void;

export type PluginControllerDeps = {
  /** Build the per-plugin public `PluginApi` (config/activity/files bridged to the host). */
  buildApi: (registry: PluginRegistry, pluginId: string, configSubscriptions: Disposables, log: Logger) => PluginApi;
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
  configSubscriptions: Disposables;
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
  private _plugins: Map<string, RegisteredPlugin> = new Map();
  readonly #changes = new Listeners();
  private _pluginsUpdate: Promise<void> = Promise.resolve();
  readonly #disposables = new Disposables();
  public readonly registry = new PluginRegistry(() => this.#changes.notify());

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
          // Bound to the ctx: a queued or late emission can't re-register on a torn-down controller.
          .then(() => lifetimeOf(this).guard(pluginsPromise))
          .then((plugins) => {
            if (!plugins) return;
            return this._syncPlugins(plugins);
          })
          // Recover the queue: a rejected emission must not permanently poison the
          // chain so later emissions never run. (`_pluginsUpdate` always resolves.)
          .catch((error) => {
            // The ctx was torn down mid-sync: nothing left to report to.
            if (!lifetimeOf(this).signal.aborted) {
              this._log.error('Failed to sync plugins', error);
            }
          });
      }),
    );
  }

  public pluginsReady(): Promise<void> {
    return this._pluginsUpdate;
  }

  public onPluginsChange(callback: Unsubscribe): Unsubscribe {
    return this.#changes.subscribe(callback);
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
          // Asks the lifetime, not the error: a setup() rejecting with its own AbortError is a plugin failure.
          if (lifetimeOf(this).signal.aborted) throw error;
          this._purgePlugin(plugin.id);
          this.#changes.notify();
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
    const configSubscriptions = new Disposables(() => this._log);
    // A logger scoped to this plugin — `[uc][<ctx-name>][plugin:<id>]`, verbose
    // tier gated by the uploader's `debug` config. Exposed as `pluginApi.logger`
    // so plugins and host paths (e.g. registerConfig override warn) share it.
    const pluginLogger = controllerLogger(this, `plugin:${plugin.id}`);
    const pluginApi = this._deps.buildApi(this.registry, plugin.id, configSubscriptions, pluginLogger);

    const uploaderApi = this._deps.getUploaderApi();
    let pluginDispose: Unsubscribe | undefined;
    try {
      // A setup that settles after the ctx is torn down is disposed right away and never registered.
      pluginDispose =
        (await lifetimeOf(this).guard(Promise.resolve(plugin.setup({ pluginApi, uploaderApi })), (lateDispose) =>
          this._disposePlugin(lateDispose ?? undefined),
        )) ?? undefined;
    } catch (error) {
      configSubscriptions.run();
      throw error;
    }

    this._plugins.set(plugin.id, { plugin, dispose: pluginDispose, configSubscriptions });
    this.#changes.notify();
  }

  private _unregisterPlugin(pluginId: string): void {
    const registered = this._plugins.get(pluginId);
    if (!registered) return;

    this._purgePlugin(pluginId);

    registered.configSubscriptions.run();

    this._disposePlugin(registered.dispose);
    this._plugins.delete(pluginId);
    this.#changes.notify();
  }

  private _disposePlugin(dispose: Unsubscribe | undefined): void {
    try {
      dispose?.();
    } catch (error) {
      this._log.warn('Failed to dispose plugin', error);
    }
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
    // Hooks are user callbacks: none is invoked, and no result applied, once the ctx is torn down.
    const { signal } = lifetimeOf(this);
    for (const hook of onAddHooks) {
      if (signal.aborted) return;
      try {
        ({ file } = await runFileHook(hook, file, signal));
      } catch (error) {
        // A hook that gave up because its signal aborted did what it was asked; only a real failure is worth a warning.
        if (signal.aborted) return;
        this._log.warn(`File hook "onAdd" from plugin "${hook.pluginId}" failed`, error);
      }
    }

    if (signal.aborted) return;
    if (file !== initialFile) {
      entry.setMany({ file: file as File, ...fileDerivedFields(file) });
    }
  }

  public destroy(): void {
    // Stop new emissions first so a queued sync can't re-register on a dead
    // controller (`#disposables` holds only the `watchPlugins` teardown).
    this.#disposables.run();
    for (const pluginId of Array.from(this._plugins.keys())) {
      this._unregisterPlugin(pluginId);
    }
    this.registry.destroy();
  }
}
