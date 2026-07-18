import { listenKeys, type MapStore, map, subscribeKeys } from 'nanostores';
import type { CollectionState } from '../abstract/controllers/CollectionStateController';
import { CollectionStateController } from '../abstract/controllers/CollectionStateController';
import { ConfigController } from '../abstract/controllers/ConfigController';
import { LazyPluginsController } from '../abstract/controllers/LazyPluginsController';
import { LocaleController } from '../abstract/controllers/LocaleController';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import { UploaderRegistry } from '../abstract/UploaderRegistry';

export type Unsubscriber = () => void;

type PubSubStore<T extends Record<string, unknown>> = MapStore<T>;

/**
 * Namespaces routed to a per-ctx controller instead of the nanostores map:
 * config (`*cfg/<key>`) → `controller.config`, locale (`*l10n/<key>`) →
 * `controller.locale`. The orphan derived-state keys are routed too (M-god
 * step 4): the six collection keys → `CollectionStateController`, `*lazyPlugins`
 * → `LazyPluginsController`. Everything else stays on nanostores.
 */
const CFG_PREFIX = '*cfg/';
const L10N_PREFIX = '*l10n/';

/**
 * The six derived collection keys owned by `CollectionStateController`, mapped
 * from their `*`-prefixed compat key to the controller's bare `SignalMap` key.
 */
const COLLECTION_STATE_KEYS = {
  '*uploadList': 'uploadList',
  '*commonProgress': 'commonProgress',
  '*collectionState': 'collectionState',
  '*collectionErrors': 'collectionErrors',
  '*groupInfo': 'groupInfo',
  '*uploadTrigger': 'uploadTrigger',
} as const satisfies Record<string, keyof CollectionState>;

/** The single key owned by `LazyPluginsController`. */
const LAZY_PLUGINS_KEY = '*lazyPlugins';

export class PubSub<T extends Record<string, unknown>> {
  private static _contexts = new Map<string, PubSubStore<Record<string, unknown>>>();
  /**
   * Callbacks waiting for a ctx that doesn't exist yet — flushed by
   * `registerCtx`. Lets a consumer attach to a ctx created LATER (e.g. the
   * standalone editor's compat bridge, when its sibling `<uc-config>` connects
   * after it) without polling. See `whenCtx`.
   */
  private static _ctxWaiters = new Map<string, Set<(ctx: PubSub<Record<string, unknown>>) => void>>();
  private _store: PubSubStore<T>;
  private _ctxId: string;

  private constructor(_ctxId: string, store: PubSubStore<T>) {
    this._ctxId = _ctxId;
    this._store = store;
  }

  public get id() {
    return this._ctxId;
  }

  /** Strip the `*cfg/` prefix, or return null if `key` is not a config key. */
  private _cfgName(key: PropertyKey): string | null {
    return typeof key === 'string' && key.startsWith(CFG_PREFIX) ? key.slice(CFG_PREFIX.length) : null;
  }

  /** Strip the `*l10n/` prefix, or return null if `key` is not a locale key. */
  private _l10nName(key: PropertyKey): string | null {
    return typeof key === 'string' && key.startsWith(L10N_PREFIX) ? key.slice(L10N_PREFIX.length) : null;
  }

  /** The `CollectionStateController` field for a collection key, or null. */
  private _collectionName(key: PropertyKey): keyof CollectionState | null {
    return typeof key === 'string' && key in COLLECTION_STATE_KEYS
      ? COLLECTION_STATE_KEYS[key as keyof typeof COLLECTION_STATE_KEYS]
      : null;
  }

  /**
   * Get (or lazily create) the per-ctx `ControllerContainer`. Shared by the
   * `_config`/`_locale` routing and the M-god step 4 orphan-state routing
   * (`_collectionState`/`_lazyPlugins`) so any of them touching a ctx first
   * resolves the one container that owns them all.
   *
   * M-god step 9a: the container lifecycle (create + cache + eager
   * Config -> Router -> Telemetry init + `whenAvailable` notify + dispose) is
   * owned by `UploaderRegistry`. This is now a thin delegate to
   * `UploaderRegistry.ensure` — the container's existence no longer depends on
   * `PubSubCompat`. Kept as a method (rather than inlined at call sites) so the
   * `_config`/`_locale`/... routers stay readable; the whole `PubSubCompat`
   * container seam is removed in step 9c.
   */
  private _resolveContainer(): ControllerContainer {
    return UploaderRegistry.ensure(this._ctxId);
  }

  private _config(): ConfigController {
    return this._resolveContainer().get(ConfigController);
  }

  private _locale(): LocaleController {
    return this._resolveContainer().get(LocaleController);
  }

  /** The container-owned owner of the six derived collection keys (M-god step 4). */
  private _collectionState(): CollectionStateController {
    return this._resolveContainer().get(CollectionStateController);
  }

  /** The container-owned owner of `*lazyPlugins` (M-god step 4). */
  private _lazyPlugins(): LazyPluginsController {
    return this._resolveContainer().get(LazyPluginsController);
  }

  /**
   * Get (or lazily create + register) the per-ctx `ControllerContainer`. Public
   * so the element layer (`ensureUploaderCtx`/`ensureUploaderScope`/
   * `ensurePluginManager`/`createDebugPrinter`) and the editor compat bridge can
   * resolve the container and pull controllers off it. Idempotent — forces the
   * container (and its eager managers) into existence, then returns it.
   */
  public container(): ControllerContainer {
    return this._resolveContainer();
  }

  /**
   * Subscribe over a controller's coarse change notification but only invoke
   * `callback` when the specific derived value changes — preserving the
   * per-key subscription semantics of the nanostores map being replaced.
   */
  private _subDerived<V>(
    read: () => V,
    subscribe: (listener: () => void) => Unsubscriber,
    callback: (value: V) => void,
    init: boolean,
  ): Unsubscriber {
    let last = read();
    if (init) callback(last);
    return subscribe(() => {
      const next = read();
      if (!Object.is(next, last)) {
        last = next;
        callback(next);
      }
    });
  }

  public pub<K extends keyof T>(key: K, value: T[K]): void {
    const cfg = this._cfgName(key);
    if (cfg !== null) {
      this._config().setCustom(cfg, value);
      return;
    }
    const loc = this._l10nName(key);
    if (loc !== null) {
      this._locale().set(loc, value as unknown as string);
      return;
    }
    const col = this._collectionName(key);
    if (col !== null) {
      this._collectionState().set(col, value as CollectionState[typeof col]);
      return;
    }
    if (key === LAZY_PLUGINS_KEY) {
      this._lazyPlugins().set(value as Parameters<LazyPluginsController['set']>[0]);
      return;
    }
    if (!(key in this._store.get())) {
      console.warn(`PubSub#pub: Key "${String(key)}" not found`);
    }
    this._store.setKey(key as never, value as never);
  }

  public sub<K extends keyof T>(key: K, callback: (value: T[K]) => void, init = true): Unsubscriber {
    const cfg = this._cfgName(key);
    if (cfg !== null) {
      const config = this._config();
      return this._subDerived<T[K]>(
        () => config.getCustom(cfg) as T[K],
        (l) => config.subscribe(l),
        callback,
        init,
      );
    }
    const loc = this._l10nName(key);
    if (loc !== null) {
      const locale = this._locale();
      return this._subDerived<T[K]>(
        () => locale.get(loc) as T[K],
        (l) => locale.subscribe(l),
        callback,
        init,
      );
    }
    const col = this._collectionName(key);
    if (col !== null) {
      const collectionState = this._collectionState();
      return this._subDerived<T[K]>(
        () => collectionState.get(col) as T[K],
        (l) => collectionState.subscribe(l),
        callback,
        init,
      );
    }
    if (key === LAZY_PLUGINS_KEY) {
      const lazyPlugins = this._lazyPlugins();
      return this._subDerived<T[K]>(
        () => lazyPlugins.get() as T[K],
        (l) => lazyPlugins.subscribe(l),
        callback,
        init,
      );
    }
    const unsubscribe = (init ? subscribeKeys : listenKeys)(this._store, [key as any], (values: Partial<T>) => {
      callback(values[key] as T[K]);
    });

    return unsubscribe;
  }

  public read<K extends keyof T>(key: K): T[K] {
    const cfg = this._cfgName(key);
    if (cfg !== null) {
      const config = this._config();
      // Preserve the v1 missing-key warning — useful for surfacing typo'd keys.
      if (!config.hasKey(cfg)) console.warn(`PubSub#read: Key "${String(key)}" not found`);
      return config.getCustom(cfg) as T[K];
    }
    const loc = this._l10nName(key);
    if (loc !== null) {
      const locale = this._locale();
      if (!locale.has(loc)) console.warn(`PubSub#read: Key "${String(key)}" not found`);
      return locale.get(loc) as T[K];
    }
    const col = this._collectionName(key);
    if (col !== null) {
      // Always seeded (the controller initializes all six) — no missing-key warning.
      return this._collectionState().get(col) as T[K];
    }
    if (key === LAZY_PLUGINS_KEY) {
      return this._lazyPlugins().get() as T[K];
    }
    if (!(key in this._store.get())) {
      console.warn(`PubSub#read: Key "${String(key)}" not found`);
    }
    return this._store.get()[key];
  }

  public add<K extends keyof T>(key: K, value: T[K], rewrite = false): void {
    const cfg = this._cfgName(key);
    if (cfg !== null) {
      const config = this._config();
      if (config.hasKey(cfg)) {
        // Built-in keys always carry a default, and registered custom keys
        // their seeded value — only an explicit rewrite overwrites them
        // (mirrors nanostores `add`'s first-write-wins).
        if (rewrite) config.setCustom(cfg, value);
      } else {
        // First sighting of a custom key (e.g. plugin `registerConfig`): seed
        // it as a registered custom config with this default.
        config.register(cfg, value);
      }
      return;
    }
    const loc = this._l10nName(key);
    if (loc !== null) {
      // Locale keys have no built-in defaults — generic first-write-wins, as
      // `LocaleManager` seeds the dictionary via `add(..., rewrite)`.
      const locale = this._locale();
      if (!locale.has(loc) || rewrite) locale.set(loc, value as unknown as string);
      return;
    }
    const col = this._collectionName(key);
    if (col !== null) {
      // The controller seeds all six at construction, so `add` is first-write-
      // wins: it only writes on an explicit `rewrite` (v1's `key in store`
      // check was always true for these seeded keys).
      if (rewrite) this._collectionState().set(col, value as CollectionState[typeof col]);
      return;
    }
    if (key === LAZY_PLUGINS_KEY) {
      // Seeded to `null` at construction — same first-write-wins as above.
      if (rewrite) this._lazyPlugins().set(value as Parameters<LazyPluginsController['set']>[0]);
      return;
    }
    const exists = key in this._store.get();

    if (!exists || rewrite) {
      // biome-ignore lint/suspicious/noExplicitAny: nanostores doesn't export AllKeys type that they use to resolve setKey param type
      this._store.setKey(key as any, value as any);
    }
  }

  public has(key: keyof T): boolean {
    const cfg = this._cfgName(key);
    if (cfg !== null) return this._config().hasKey(cfg);
    const loc = this._l10nName(key);
    if (loc !== null) return this._locale().has(loc);
    // The six collection keys and `*lazyPlugins` deliberately fall through to
    // the store: their v1 seed still lives in the nanostores map (left there
    // per step 9's cleanup note), so `has` reflects whether THIS ctx was
    // created as an uploader/solution ctx (seeded) vs a bare/plain one — exactly
    // v1's `key in store`. The controller (which seeds all of them
    // unconditionally) is only the value source for read/pub/sub/add.
    return key in this._store.get();
  }

  public get store(): T {
    return this._store.get();
  }

  public static registerCtx<T extends Record<string, unknown>>(initialValue: T, ctxId: string): PubSub<T> {
    if (PubSub._contexts.has(ctxId)) {
      throw new Error(`PubSub: Context with id "${ctxId}" already exists`);
    }

    const store = map<T>(initialValue);

    PubSub._contexts.set(ctxId, store);
    const wrapper = new PubSub<T>(ctxId, store);

    // Notify anyone waiting for this ctx to appear (see `whenCtx`). Deferred to
    // a microtask so waiters don't run re-entrantly INSIDE `registerCtx` — e.g.
    // the editor compat bridge reading `*cfg/*` before the caller
    // (`ensureUploaderCtx`) has finished its own controller setup. Each waiter
    // is isolated so one throwing can't break `registerCtx` for the rest.
    const waiters = PubSub._ctxWaiters.get(ctxId);
    if (waiters) {
      PubSub._ctxWaiters.delete(ctxId);
      queueMicrotask(() => {
        for (const waiter of [...waiters]) {
          // Skip waiters cancelled between scheduling and this microtask (the
          // canceller deletes from this same Set — captured by `whenCtx`).
          if (!waiters.has(waiter)) {
            continue;
          }
          try {
            waiter(wrapper as unknown as PubSub<Record<string, unknown>>);
          } catch (err) {
            console.error('[PubSub] whenCtx waiter failed', err);
          }
        }
      });
    }

    return wrapper;
  }

  public static deleteCtx(ctxId: string): void {
    PubSub._contexts.delete(ctxId);
    // M-god step 9a: container teardown (null-notify before dispose, preserving
    // the v1 order where consumers release before the controllers are destroyed)
    // lives in `UploaderRegistry.dispose`. No-op if the ctx never had a
    // container. Delete the nanostores map FIRST so a null-notify consumer sees
    // `hasCtx(ctxId) === false` (a teardown-ordering invariant tests pin).
    UploaderRegistry.dispose(ctxId);
  }

  /**
   * The per-ctx `ControllerContainer` for `ctxId`, or `null` if none has been
   * created yet (a ctx map can exist without a container — created by a bare
   * `registerCtx` before any config/controller touch). Exposed for the
   * consumer-refcount teardown predicate (`ctx-lifecycle.isCtxUnreferenced`),
   * which routes through `container.isUnreferenced()` (M-god step 6a) — the
   * container is the single owner of both the controllers and the consumer set.
   */
  public static getContainer(ctxId: string): ControllerContainer | null {
    return UploaderRegistry.get(ctxId) ?? null;
  }

  public static getCtx<T extends Record<string, unknown> = Record<string, unknown>>(ctxId: string): PubSub<T> | null {
    const store = PubSub._contexts.get(ctxId);
    if (!store) {
      return null;
    }
    return new PubSub<T>(ctxId, store as PubSubStore<T>);
  }

  public static hasCtx(ctxId: string): boolean {
    return PubSub._contexts.has(ctxId);
  }

  /**
   * Run `cb` with the ctx as soon as it exists: synchronously now if already
   * registered, otherwise when `registerCtx` next creates it. Returns an
   * unsubscribe that cancels a still-pending waiter (no-op once fired). Lets a
   * consumer bind to a ctx created out of order without polling.
   */
  public static whenCtx<T extends Record<string, unknown> = Record<string, unknown>>(
    ctxId: string,
    cb: (ctx: PubSub<T>) => void,
  ): () => void {
    const existing = PubSub.getCtx<T>(ctxId);
    if (existing) {
      cb(existing);
      return () => {};
    }
    const waiter = cb as unknown as (ctx: PubSub<Record<string, unknown>>) => void;
    let waiters = PubSub._ctxWaiters.get(ctxId);
    if (!waiters) {
      waiters = new Set();
      PubSub._ctxWaiters.set(ctxId, waiters);
    }
    waiters.add(waiter);
    // Capture the Set directly: `registerCtx` deletes the map entry when it
    // flushes (before the microtask fires), so a map lookup here would miss it.
    // Deleting from the captured Set still cancels a scheduled-but-unfired waiter.
    const set = waiters;
    return () => {
      set.delete(waiter);
      if (set.size === 0 && PubSub._ctxWaiters.get(ctxId) === set) {
        PubSub._ctxWaiters.delete(ctxId);
      }
    };
  }
}
