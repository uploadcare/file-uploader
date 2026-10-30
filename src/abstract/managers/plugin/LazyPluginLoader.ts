import type { ConfigType } from '../../../types/index';
import type { ConfigController } from '../../controllers/ConfigController';
import type { LazyPluginsController } from '../../controllers/LazyPluginsController';
import { Disposables } from '../../di/Disposables';
import { logger } from '../../logger';
import type { UploaderPlugin } from './PluginTypes';

const log = logger.scope('lazy-plugin-loader');

export type ConfigGetter = <K extends keyof ConfigType>(key: K) => ConfigType[K];

export type LazyPluginEntry = {
  configDeps: readonly (keyof ConfigType)[];
  isEnabled: (get: ConfigGetter) => boolean;
  load: () => UploaderPlugin | undefined | Promise<UploaderPlugin | undefined>;
};

type ResolvedEntry = {
  isEnabled: () => boolean;
  load: () => UploaderPlugin | undefined | Promise<UploaderPlugin | undefined>;
};

const resolveLazyPlugins = async ({
  entries,
  signal,
}: {
  entries: ResolvedEntry[];
  signal: AbortSignal;
}): Promise<UploaderPlugin[]> => {
  const loadResults = await Promise.all(
    entries.map(async (entry): Promise<UploaderPlugin | undefined> => {
      if (!entry.isEnabled()) return undefined;
      try {
        const plugin = await entry.load();
        if (signal.aborted || !entry.isEnabled()) return undefined;
        return plugin ?? undefined;
      } catch (error) {
        if (!signal.aborted) {
          log.warn(`Failed to load lazy plugin`, error);
        }
        return undefined;
      }
    }),
  );

  return loadResults.filter((p): p is UploaderPlugin => p !== undefined);
};

export class LazyPluginLoader {
  // Isolate-and-warn teardown: one throwing unsubscribe doesn't keep the rest subscribed.
  private _subs = new Disposables(() => log);
  private _unsubLazyPlugins: () => void;
  private _abortController?: AbortController;

  public constructor(
    private readonly _lazyPlugins: LazyPluginsController,
    private readonly _config: ConfigController,
    private readonly _onCompute: (plugins: Promise<UploaderPlugin[] | undefined>) => void,
  ) {
    // Read the current entries now and re-run on every change.
    // `LazyPluginsController` (the owner of the entries) dedups on `Object.is`
    // before notifying, so no spurious re-runs.
    const apply = () => this._setEntries(this._lazyPlugins.get() ?? []);
    apply();
    this._unsubLazyPlugins = this._lazyPlugins.subscribe(apply);
  }

  private _setEntries(entries: LazyPluginEntry[]): void {
    this._subs.run();

    if (entries.length === 0) return;

    // The config keys whose changes must recompute the resolved plugin list:
    // `plugins` plus every entry's declared `configDeps`, read off the
    // `ConfigController`.
    const deps = new Set<keyof ConfigType>(['plugins']);
    for (const entry of entries) {
      for (const dep of entry.configDeps) {
        deps.add(dep);
      }
    }

    // `ConfigController.subscribe` is coarse (fires on any config change), so
    // snapshot the dep values and recompute only when one of them actually
    // changes — preserving the per-key subscription granularity the previous
    // `ctx.sub(dep, recompute, false)` facade subscriptions gave.
    const depKeys = [...deps];
    let lastValues = depKeys.map((key) => this._config.get(key));
    this._subs.add(
      this._config.subscribe(() => {
        const nextValues = depKeys.map((key) => this._config.get(key));
        const changed = nextValues.some((value, i) => !Object.is(value, lastValues[i]));
        if (changed) {
          lastValues = nextValues;
          this._compute(entries);
        }
      }),
    );

    this._compute(entries);
  }

  private _compute(entries: LazyPluginEntry[]): void {
    this._abortController?.abort();
    const controller = new AbortController();
    this._abortController = controller;

    const get: ConfigGetter = <K extends keyof ConfigType>(key: K) => this._config.get(key);

    const userPlugins = get('plugins');

    const pluginsPromise = resolveLazyPlugins({
      entries: entries.map((entry) => ({
        isEnabled: () => entry.isEnabled(get),
        load: entry.load,
      })),
      signal: controller.signal,
    }).then((lazyPlugins) => {
      if (controller.signal.aborted) return undefined;
      return [...userPlugins, ...lazyPlugins];
    });

    this._onCompute(pluginsPromise);
  }

  public destroy(): void {
    this._unsubLazyPlugins();
    this._subs.run();
    this._abortController?.abort();
  }
}
