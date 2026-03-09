import type { PubSub } from '../../../lit/PubSubCompat';
import type { SharedState } from '../../../lit/SharedState';
import type { ConfigType } from '../../../types/index';
import { sharedConfigKey } from '../../sharedConfigKey';
import type { ConfigGetter, LazyPluginEntry } from './lazyPluginRegistry';
import { withLazyPlugins } from './lazyPluginRegistry';
import type { UploaderPlugin } from './PluginTypes';

export class LazyPluginLoader {
  private _subs: Set<() => void> = new Set();
  private _unsubLazyPlugins: () => void;
  private _abortController?: AbortController;

  public constructor(
    private readonly _ctx: PubSub<SharedState>,
    private readonly _onResolved: (plugins: UploaderPlugin[]) => void,
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

    withLazyPlugins({
      plugins: () => get('plugins'),
      entries: entries.map((entry) => ({
        pluginId: entry.pluginId,
        isEnabled: () => entry.isEnabled(get),
        load: entry.load,
      })),
      signal: controller.signal,
    }).then((plugins) => {
      if (!controller.signal.aborted) {
        this._onResolved(plugins);
      }
    });
  }

  public destroy(): void {
    this._unsubLazyPlugins();
    for (const unsub of this._subs) unsub();
    this._subs.clear();
    this._abortController?.abort();
  }
}
