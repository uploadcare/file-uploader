import type { CustomConfigDefinition } from '../../abstract/customConfigOptions';
import { initialConfig } from '../../blocks/Config/initialConfig';
import type { ConfigType } from '../../types/exported';
import { SignalMap } from '../di/SignalMap';

/**
 * Pure-logic config store. Knows nothing about DOM, attributes, or Lit.
 *
 * In the v1 → v2 strangler this is the source of truth for the `*cfg/*` state
 * that used to live in the per-ctx store map; the v1 ctx facade routes those
 * keys here (see its `*cfg/` facade). For now it is a raw typed container:
 * value coercion (`normalizeConfigValue`), the `cdnCname`/`cameraModes`
 * computed properties, and the attribute/property bridge all still live in the
 * `<uc-config>` element, so behavior is byte-identical to v1. Those concerns
 * migrate into this controller in later milestones (when `<uc-config>` is
 * finally retired).
 *
 * Custom (plugin-registered) keys live in the same signal-backed map as
 * built-ins — `register()` adds them, `getCustom`/`setCustom` access them.
 *
 * Backed by a composed `SignalMap` (has-a, not a base class): reads auto-track
 * under a `SignalWatcher`, `set()`/`setCustom()` dedup with `Object.is` and
 * fire the map's coarse notify, and `subscribe()` fans out on any change —
 * preserving the exact `get`/`set`/`subscribe`/`values`/`notify` semantics the
 * the v1 ctx facade `*cfg/` routing depends on. The map is typed over `ConfigType`
 * intersected with a string index so runtime custom keys type cleanly.
 */
export class ConfigController {
  // Signal-backed store, seeded with the built-in defaults. The `Record<string,
  // unknown>` arm models the dynamic plugin-registered keyspace so custom-key
  // access needs no per-call cast.
  #state = new SignalMap<ConfigType & Record<string, unknown>>(initialConfig);
  #customKeys = new Set<string>();
  #customDefs = new Map<string, CustomConfigDefinition<unknown>>();

  /** Live config object (stable reference — mutate via `set`/`setCustom`). */
  public get values(): Readonly<ConfigType> {
    return this.#state.values;
  }

  public get<K extends keyof ConfigType>(key: K): ConfigType[K] {
    // Every built-in is seeded at construction, so the value is always present.
    return this.#state.get(key) as ConfigType[K];
  }

  /**
   * Reactive, auto-tracking read of a config key. Reading it inside a
   * `SignalWatcher` update (a migrated `ChildBlock.render()`) subscribes that
   * render to THIS key, so a later `set()` re-renders the block with no manual
   * `subConfigValue` subscription.
   *
   * Distinct from `get()`, which reads the fast bag and is NOT tracked — kept
   * for the still-imperative readers (every `api.cfg` lookup, v1
   * `subConfigValue`, non-migrated blocks) whose hot-path per-read signal
   * overhead measurably destabilized the parallel e2e suite (see `SignalMap`).
   * Both coexist only during the strangler migration: once every reader is a
   * tracked reader, `get()` can route through the signal and this splits away.
   */
  public getTracked<K extends keyof ConfigType>(key: K): ConfigType[K] {
    return this.#state.signal(key).get() as ConfigType[K];
  }

  /** Notifies only when the value actually changes (`Object.is` dedup). */
  public set<K extends keyof ConfigType>(key: K, value: ConfigType[K]): void {
    this.#state.set(key, value);
  }

  /** Coarse subscribe — fires on any config change, not per-key. */
  public subscribe(listener: () => void): () => void {
    return this.#state.subscribe(listener);
  }

  /** Coarse notify with no state change — for a re-render on a non-keyed change. */
  public notify(): void {
    this.#state.notify();
  }

  /** True for any known key — a built-in default or a registered custom key. */
  public hasKey(name: string): boolean {
    // Own-property check: `in` would walk the prototype chain and wrongly
    // report `toString`, `constructor`, `__proto__`, etc. as known keys.
    return Object.hasOwn(initialConfig, name) || this.#customKeys.has(name);
  }

  // ─── Custom (plugin-registered) keys ───────────────────────────────────

  public register<T>(nameOrDef: string | CustomConfigDefinition<T>, defaultValue?: T): void {
    const def: CustomConfigDefinition<T> =
      typeof nameOrDef === 'string' ? { name: nameOrDef, defaultValue: defaultValue as T } : nameOrDef;
    if (this.#customKeys.has(def.name)) {
      // Already registered — keep the existing value (idempotent re-register).
      return;
    }
    this.#customKeys.add(def.name);
    this.#customDefs.set(def.name, def as CustomConfigDefinition<unknown>);
    // Keep any value set before the plugin registered (e.g. an attribute that
    // landed first), otherwise seed the registered default. `seed` is a no-op
    // when the key is already present, mirroring the v1 own-property check, so
    // an explicit pre-registration write (including of `undefined`) is
    // preserved. The single `notify()` below fires exactly once either way.
    this.#state.seed(def.name, def.defaultValue);
    this.#state.notify();
  }

  public customDefinition(name: string): CustomConfigDefinition<unknown> | undefined {
    return this.#customDefs.get(name);
  }

  public getCustom<T = unknown>(name: string): T {
    return this.#state.get(name) as T;
  }

  public setCustom(name: string, value: unknown): void {
    this.#state.set(name, value);
  }

  public destroy(): void {
    this.#customKeys.clear();
    this.#customDefs.clear();
    this.#state.destroy();
  }
}
