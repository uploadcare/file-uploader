import { listenKeys, type MapStore, map, subscribeKeys } from 'nanostores';
import type { ConfigController } from '../abstract/controllers/ConfigController';
import type { LocaleController } from '../abstract/controllers/LocaleController';
import { UploaderController } from '../abstract/controllers/UploaderController';
import { UploaderRegistry } from '../abstract/UploaderRegistry';

export type Unsubscriber = () => void;

type PubSubStore<T extends Record<string, unknown>> = MapStore<T>;

/**
 * Namespaces routed to the per-ctx `UploaderController` instead of the
 * nanostores map: config (`*cfg/<key>`) → `controller.config`, locale
 * (`*l10n/<key>`) → `controller.locale`, and the exact `*solution` key →
 * `controller.solution` (M8). Everything else stays on nanostores.
 */
const CFG_PREFIX = '*cfg/';
const L10N_PREFIX = '*l10n/';
const SOLUTION_KEY = '*solution';

export class PubSub<T extends Record<string, unknown>> {
  private static _contexts = new Map<string, PubSubStore<Record<string, unknown>>>();
  /**
   * One `UploaderController` per ctx-name. Created lazily the first time a
   * `*cfg/*` key is touched on a context (so per-upload-entry stores, which
   * never carry config keys, never get a controller). This is the v1 → v2
   * strangler seam: config state lives in `controller.config`, not in the
   * nanostores map, while the rest of the shared state stays on nanostores.
   */
  private static _controllers = new Map<string, UploaderController>();

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

  /** Get (or lazily create + register) the controller for this ctx. */
  private _uploader(): UploaderController {
    let controller = PubSub._controllers.get(this._ctxId);
    if (!controller) {
      controller = new UploaderController();
      PubSub._controllers.set(this._ctxId, controller);
      UploaderRegistry.register(this._ctxId, controller);
    }
    return controller;
  }

  private _config(): ConfigController {
    return this._uploader().config;
  }

  private _locale(): LocaleController {
    return this._uploader().locale;
  }

  /**
   * Get (or lazily create + register) the `UploaderController` for this ctx.
   * Public so the v1 element layer can resolve the controller that owns the
   * shared upload collection (the `*uploadCollection` instance).
   */
  public uploaderController(): UploaderController {
    return this._uploader();
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
    if (key === SOLUTION_KEY) {
      this._uploader().setSolution(value as string | null);
      return;
    }
    const loc = this._l10nName(key);
    if (loc !== null) {
      this._locale().set(loc, value as unknown as string);
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
    if (key === SOLUTION_KEY) {
      const uploader = this._uploader();
      return this._subDerived<T[K]>(
        () => uploader.solution as T[K],
        (l) => uploader.subscribeSolution(l),
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
    if (key === SOLUTION_KEY) {
      return this._uploader().solution as T[K];
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
    if (key === SOLUTION_KEY) {
      // The controller always carries the key (default `null`), so a plain
      // `add` (the `init$` seeding) never clobbers a published solution name —
      // only an explicit rewrite writes through.
      if (rewrite) this._uploader().setSolution(value as string | null);
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
    if (key === SOLUTION_KEY) return true; // always known on the controller
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
    return new PubSub<T>(ctxId, store);
  }

  public static deleteCtx(ctxId: string): void {
    PubSub._contexts.delete(ctxId);
    const controller = PubSub._controllers.get(ctxId);
    if (controller) {
      PubSub._controllers.delete(ctxId);
      UploaderRegistry.unregister(ctxId, controller);
      controller.destroy();
    }
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
}
