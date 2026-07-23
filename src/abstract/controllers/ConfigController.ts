import { BUILTIN_DESCRIPTORS } from '../../blocks/Config/builtin-descriptors';
import { initialConfig } from '../../blocks/Config/initialConfig';
import type { ConfigType } from '../../types/exported';
import { type ConfigKeyDescriptor, resolveConfigDescriptor } from '../config-descriptor';
import type { CustomConfigDefinition } from '../customConfigOptions';
import type { ReactiveStore } from '../di/ReactiveStore';
import { type ObserveOptions, SignalMap } from '../di/SignalMap';

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
export class ConfigController implements ReactiveStore<ConfigType> {
  // Signal-backed store, seeded with the built-in defaults. The `Record<string,
  // unknown>` arm models the dynamic plugin-registered keyspace so custom-key
  // access needs no per-call cast.
  #state = new SignalMap<ConfigType & Record<string, unknown>>(initialConfig);
  // Dynamically-registered (plugin) descriptors, overlaid on the shared
  // module-level BUILTIN_DESCRIPTORS. Per-ctx. `#descriptorOwners` maps a key to
  // the id that registered it, so `unregisterByOwner` can drop a source's keys.
  #customDescriptors = new Map<string, ConfigKeyDescriptor>();
  #descriptorOwners = new Map<string, string>();
  // Fired when the descriptor SET changes (register/unregister) — the config
  // host (WithConfig) subscribes to rebuild its attribute maps + subscriptions,
  // replacing the old plugin-manager `onPluginsChange` coupling.
  #schemaListeners = new Set<() => void>();
  // Config-writer hosts registered for this ctx (one config host per ctx is the
  // contract). Stored by identity as DOM-free `{ isConnected }` handles — this
  // controller never reads the DOM or warns; the element/mixin layer inspects
  // `getWriters()` and emits the multi-writer warning (keeps this class
  // DOM-free per the controller-layering rule).
  #writers = new Set<ConfigWriterHandle>();

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
    return this.#state.getTracked(key) as ConfigType[K];
  }

  /** Notifies only when the value actually changes (`Object.is` dedup). */
  public set<K extends keyof ConfigType>(key: K, value: ConfigType[K]): void {
    this.#state.set(key, value);
  }

  /** Batch set built-in keys — one coalesced notify (see `SignalMap.setMany`). */
  public setMany(patch: Partial<ConfigType>): void {
    this.#state.setMany(patch);
  }

  /** Coarse subscribe — fires on any config change, not per-key. */
  public subscribe(listener: () => void): () => void {
    return this.#state.subscribe(listener);
  }

  /**
   * Atomic per-key subscription: fires only when THIS key changes (`Object.is`
   * dedup), unlike the coarse `subscribe`. Pass `{ immediate: true }` to also
   * fire once with the current value on subscribe. The successor to
   * `ChildBlock.subConfigValue` for side-effecting reactions that can't be pure
   * render reads (a value recomputed elsewhere, or pushed to a non-reactive
   * sink); pair with `@subscription` for auto-teardown.
   */
  public observe<K extends keyof ConfigType>(
    key: K,
    listener: (value: ConfigType[K]) => void,
    options?: ObserveOptions,
  ): () => void {
    // Built-ins are always seeded, so the map's `| undefined` value arm never
    // materializes for a `ConfigType` key — narrow it at this typed boundary.
    return this.#state.observe(
      key,
      listener as (value: (ConfigType & Record<string, unknown>)[K] | undefined) => void,
      options,
    );
  }

  /**
   * Atomic per-key subscription for a plugin-registered CUSTOM key (the
   * `getCustom` keyspace), with the same `Object.is` dedup + optional
   * `{ immediate }` as `observe`. Separate from `observe` because custom keys
   * live outside the typed `ConfigType` surface.
   */
  public observeCustom<T = unknown>(name: string, listener: (value: T) => void, options?: ObserveOptions): () => void {
    return this.#state.observe(name, listener as (value: unknown) => void, options);
  }

  /** Coarse notify with no state change — for a re-render on a non-keyed change. */
  public notify(): void {
    this.#state.notify();
  }

  /** True for any known key — a built-in default or a registered custom key. */
  public hasKey(name: string): boolean {
    return BUILTIN_DESCRIPTORS.has(name) || this.#customDescriptors.has(name);
  }

  // ─── Config schema (descriptors) ────────────────────────────────────────

  /**
   * The resolved descriptor for ANY key — built-in or dynamically registered —
   * or `undefined` if the key is unknown. Built-ins come from the shared
   * `BUILTIN_DESCRIPTORS`; dynamic keys from `register`.
   */
  public descriptor(name: string): ConfigKeyDescriptor | undefined {
    return this.#customDescriptors.get(name) ?? BUILTIN_DESCRIPTORS.get(name);
  }

  /** Every dynamically-registered (non-built-in) descriptor, for the config host. */
  public getCustomDescriptors(): ConfigKeyDescriptor[] {
    return [...this.#customDescriptors.values()];
  }

  /** Subscribe to descriptor-set changes (register/unregister). Returns an unsubscribe. */
  public onSchemaChange(listener: () => void): () => void {
    this.#schemaListeners.add(listener);
    return () => this.#schemaListeners.delete(listener);
  }

  #notifySchemaChange(): void {
    for (const listener of this.#schemaListeners) {
      listener();
    }
  }

  /**
   * Register a dynamic config key from its descriptor (built-ins are always
   * present). Idempotent — a re-register keeps the existing descriptor + value
   * (first-registration-wins). `ownerId` lets a later `unregisterByOwner` drop
   * every key a given source registered. Fires the schema-changed signal (and
   * seeds the default value, keeping any value written before registration).
   */
  public register<T>(def: CustomConfigDefinition<T>, ownerId?: string): void {
    if (this.#customDescriptors.has(def.name)) {
      return;
    }
    // Erase the value type at the registry boundary (descriptors are stored + read
    // dynamically by string key); the descriptor's own functions handle their type.
    this.#customDescriptors.set(def.name, resolveConfigDescriptor(def) as unknown as ConfigKeyDescriptor);
    if (ownerId !== undefined) {
      this.#descriptorOwners.set(def.name, ownerId);
    }
    // Keep any value set before registration (e.g. an attribute that landed
    // first), otherwise seed the registered default. `seed` is a no-op when the
    // key already has a value, so an explicit pre-registration write (including
    // `undefined`) is preserved. The `notify()` fires exactly once either way.
    this.#state.seed(def.name, def.defaultValue);
    this.#state.notify();
    this.#notifySchemaChange();
  }

  /** Drop every dynamic key registered by `ownerId` (e.g. on plugin removal). */
  public unregisterByOwner(ownerId: string): void {
    let changed = false;
    for (const [name, owner] of this.#descriptorOwners) {
      if (owner === ownerId) {
        this.#customDescriptors.delete(name);
        this.#descriptorOwners.delete(name);
        changed = true;
      }
    }
    if (changed) {
      this.#notifySchemaChange();
    }
  }

  /** @deprecated Use {@link descriptor}. Returns only DYNAMIC descriptors (not built-ins). */
  public customDefinition(name: string): ConfigKeyDescriptor | undefined {
    return this.#customDescriptors.get(name);
  }

  public getCustom<T = unknown>(name: string): T {
    return this.#state.get(name) as T;
  }

  public setCustom(name: string, value: unknown): void {
    this.#state.set(name, value);
  }

  // ─── Config-writer registry (one config host per ctx) ───────────────────

  /** Register a config-host element as a writer for this ctx (by identity). */
  public registerWriter(host: ConfigWriterHandle): void {
    this.#writers.add(host);
  }

  /** Deregister a config-host element (on release / disconnect / ctx switch). */
  public unregisterWriter(host: ConfigWriterHandle): void {
    this.#writers.delete(host);
  }

  /** Currently-registered config-writer hosts for this ctx. */
  public getWriters(): ConfigWriterHandle[] {
    return [...this.#writers];
  }

  public destroy(): void {
    this.#customDescriptors.clear();
    this.#descriptorOwners.clear();
    this.#schemaListeners.clear();
    this.#writers.clear();
    this.#state.destroy();
  }
}

/**
 * A config-writer host as seen by the {@link ConfigController} registry — the
 * DOM-free lower bound the controller needs (identity + liveness). The mixin
 * passes the element (`this`), which satisfies this via `Element.isConnected`.
 */
export interface ConfigWriterHandle {
  readonly isConnected: boolean;
}
