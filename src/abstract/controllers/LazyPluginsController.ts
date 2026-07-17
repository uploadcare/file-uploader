import { SignalMap } from '../di/SignalMap';
import type { LazyPluginEntry } from '../managers/plugin/LazyPluginLoader';

/**
 * Owner of the orphan `*lazyPlugins` key: the list of lazily-loadable plugin
 * entries a solution tag declares (`SolutionChildBlock` pubs it in
 * `controllerReady`, `LazyPluginLoader` subs it). In v1 this lived in the per-ctx
 * nanostores map with no controller owner; this is its signal-backed owner,
 * routed through `PubSubCompat`.
 *
 * Independent + container-resolved (deliberately NOT folded onto
 * `PluginController`, which is created late in `ensurePluginManager` and is
 * api-coupled — this owner must exist as early as any `*lazyPlugins` touch).
 *
 * Backed by a single-key composed `SignalMap` (has-a, like `ConfigController`)
 * rather than a bare `@signalState` field: `_subDerived` in `PubSubCompat`
 * needs a SYNCHRONOUS coarse `subscribe`/notify (the v1 nanostores contract
 * `LazyPluginLoader` relies on), which the `SignalMap`'s `Listeners` provide and
 * a raw signal (async watcher/effect) does not. `lazyPlugins` is NOT on a hot
 * read path, so the fast-bag-vs-signal tradeoff is moot here; the `SignalMap`
 * is chosen for the sync-subscribe contract and consistency with the other
 * state owners.
 */
type LazyPluginsState = { lazyPlugins: LazyPluginEntry[] | null };

export class LazyPluginsController {
  #state = new SignalMap<LazyPluginsState>({ lazyPlugins: null });

  /** The current lazy-plugin entries, or `null` before any solution declares them. */
  public get(): LazyPluginEntry[] | null {
    return this.#state.get('lazyPlugins') ?? null;
  }

  /** `Object.is` dedup; a real change fires the coarse notify. */
  public set(entries: LazyPluginEntry[] | null): void {
    this.#state.set('lazyPlugins', entries);
  }

  public subscribe(listener: () => void): () => void {
    return this.#state.subscribe(listener);
  }

  public destroy(): void {
    this.#state.destroy();
  }
}
