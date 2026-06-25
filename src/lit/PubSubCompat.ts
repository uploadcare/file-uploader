import { listenKeys, type MapStore, map, subscribeKeys } from 'nanostores';
import type { ConfigController } from '../abstract/controllers/ConfigController';
import { UploaderController } from '../abstract/controllers/UploaderController';
import { UploaderRegistry } from '../abstract/UploaderRegistry';

export type Unsubscriber = () => void;

type PubSubStore<T extends Record<string, unknown>> = MapStore<T>;

/** Namespace for config keys (`*cfg/<configKey>`). Routed to the controller. */
const CFG_PREFIX = '*cfg/';

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
    if (typeof key === 'string' && key.startsWith(CFG_PREFIX)) {
      return key.slice(CFG_PREFIX.length);
    }
    return null;
  }

  /** Get (or lazily create + register) the config controller for this ctx. */
  private _config(): ConfigController {
    let controller = PubSub._controllers.get(this._ctxId);
    if (!controller) {
      controller = new UploaderController();
      PubSub._controllers.set(this._ctxId, controller);
      UploaderRegistry.register(this._ctxId, controller);
    }
    return controller.config;
  }

  public pub<K extends keyof T>(key: K, value: T[K]): void {
    const name = this._cfgName(key);
    if (name !== null) {
      this._config().setCustom(name, value);
      return;
    }
    if (!(key in this._store.get())) {
      console.warn(`PubSub#pub: Key "${String(key)}" not found`);
    }
    this._store.setKey(key as never, value as never);
  }

  public sub<K extends keyof T>(key: K, callback: (value: T[K]) => void, init = true): Unsubscriber {
    const name = this._cfgName(key);
    if (name !== null) {
      // The controller notifies on ANY config change; re-derive this key's
      // value and only invoke `callback` when it actually changes, preserving
      // the per-key subscription semantics of the nanostores map.
      const cfg = this._config();
      let last = cfg.getCustom(name);
      if (init) callback(last as T[K]);
      return cfg.subscribe(() => {
        const next = cfg.getCustom(name);
        if (!Object.is(next, last)) {
          last = next;
          callback(next as T[K]);
        }
      });
    }
    const unsubscribe = (init ? subscribeKeys : listenKeys)(this._store, [key as any], (values: Partial<T>) => {
      callback(values[key] as T[K]);
    });

    return unsubscribe;
  }

  public read<K extends keyof T>(key: K): T[K] {
    const name = this._cfgName(key);
    if (name !== null) {
      return this._config().getCustom(name) as T[K];
    }
    if (!(key in this._store.get())) {
      console.warn(`PubSub#read: Key "${String(key)}" not found`);
    }
    return this._store.get()[key];
  }

  public add<K extends keyof T>(key: K, value: T[K], rewrite = false): void {
    const name = this._cfgName(key);
    if (name !== null) {
      const cfg = this._config();
      if (cfg.hasKey(name)) {
        // Built-in keys always carry a default, and registered custom keys
        // their seeded value — only an explicit rewrite overwrites them
        // (mirrors nanostores `add`'s first-write-wins).
        if (rewrite) cfg.setCustom(name, value);
      } else {
        // First sighting of a custom key (e.g. plugin `registerConfig`): seed
        // it as a registered custom config with this default.
        cfg.register(name, value);
      }
      return;
    }
    const exists = key in this._store.get();

    if (!exists || rewrite) {
      // biome-ignore lint/suspicious/noExplicitAny: nanostores doesn't export AllKeys type that they use to resolve setKey param type
      this._store.setKey(key as any, value as any);
    }
  }

  public has(key: keyof T): boolean {
    const name = this._cfgName(key);
    if (name !== null) {
      return this._config().hasKey(name);
    }
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
