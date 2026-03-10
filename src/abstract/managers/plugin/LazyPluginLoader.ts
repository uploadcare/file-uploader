import type { PubSub } from '../../../lit/PubSubCompat';
import type { SharedState } from '../../../lit/SharedState';
import type { ConfigType } from '../../../types/index';
import { sharedConfigKey } from '../../sharedConfigKey';
import type { UploaderPlugin } from './PluginTypes';

export type ConfigGetter = <K extends keyof ConfigType>(key: K) => ConfigType[K];

export type LazyPluginEntry = {
  pluginId: string;
  configDeps: readonly (keyof ConfigType)[];
  isEnabled: (get: ConfigGetter) => boolean;
  load: () => UploaderPlugin | undefined | Promise<UploaderPlugin | undefined>;
};

type ResolvedEntry = {
  pluginId: string;
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
          console.warn(`[${entry.pluginId}] Failed to load plugin`, error);
        }
        return undefined;
      }
    }),
  );

  return loadResults.filter((p): p is UploaderPlugin => p !== undefined);
};

export class LazyPluginLoader {
  private _subs: Set<() => void> = new Set();
  private _unsubLazyPlugins: () => void;
  private _abortController?: AbortController;

  public constructor(
    private readonly _ctx: PubSub<SharedState>,
    private readonly _onCompute: (plugins: Promise<UploaderPlugin[] | undefined>) => void,
  ) {
    this._unsubLazyPlugins = this._ctx.sub('*lazyPlugins', (entries) => {
      this._setEntries(entries ?? []);
    });
  }

  private _setEntries(entries: LazyPluginEntry[]): void {
    for (const unsub of this._subs) unsub();
    this._subs.clear();

    if (entries.length === 0) return;

    const deps = new Set<keyof SharedState>([sharedConfigKey('plugins')]);
    for (const entry of entries) {
      for (const dep of entry.configDeps) {
        deps.add(sharedConfigKey(dep));
      }
    }

    const recompute = () => this._compute(entries);
    for (const dep of deps) {
      this._subs.add(this._ctx.sub(dep, recompute, false));
    }

    this._compute(entries);
  }

  private _compute(entries: LazyPluginEntry[]): void {
    this._abortController?.abort();
    const controller = new AbortController();
    this._abortController = controller;

    const get: ConfigGetter = <K extends keyof ConfigType>(key: K) =>
      this._ctx.read(sharedConfigKey(key)) as unknown as ConfigType[K];

    const lazyIds = new Set(entries.map((e) => e.pluginId));
    const userPlugins = (get('plugins') ?? []).filter((p) => !lazyIds.has(p?.id));

    const pluginsPromise = resolveLazyPlugins({
      entries: entries.map((entry) => ({
        pluginId: entry.pluginId,
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
    for (const unsub of this._subs) unsub();
    this._subs.clear();
    this._abortController?.abort();
  }
}
