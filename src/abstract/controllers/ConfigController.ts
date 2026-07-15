import type { CustomConfigDefinition } from '../../abstract/customConfigOptions';
import { initialConfig } from '../../blocks/Config/initialConfig';
import type { ConfigType } from '../../types/exported';
import { StateController } from './StateController';

/**
 * Pure-logic config store. Knows nothing about DOM, attributes, or Lit.
 *
 * In the v1 → v2 strangler this is the source of truth for the `*cfg/*` state
 * that used to live in the per-ctx nanostores map; `PubSubCompat` routes those
 * keys here (see its `*cfg/` facade). For now it is a raw typed container:
 * value coercion (`normalizeConfigValue`), the `cdnCname`/`cameraModes`
 * computed properties, and the attribute/property bridge all still live in the
 * `<uc-config>` element, so behavior is byte-identical to v1. Those concerns
 * migrate into this controller in later milestones (when `<uc-config>` is
 * finally retired).
 *
 * Custom (plugin-registered) keys live in the same backing object as built-ins
 * — `register()` adds them, `getCustom`/`setCustom` access them.
 *
 * Extends the shared `StateController` (get/set/subscribe/notify/destroy) and
 * adds config-specific custom-key registration on top.
 */
export class ConfigController extends StateController<ConfigType> {
  private _customKeys = new Set<string>();
  private _customDefs = new Map<string, CustomConfigDefinition<unknown>>();

  public constructor() {
    // Null-prototype backing object: custom (plugin-registered) key names flow
    // into `getCustom`/`setCustom`, so a key like `__proto__` must create a
    // plain own property here rather than mutate the prototype chain.
    super(Object.assign(Object.create(null), initialConfig));
  }

  /** True for any known key — a built-in default or a registered custom key. */
  public hasKey(name: string): boolean {
    // Own-property check: `in` would walk the prototype chain and wrongly
    // report `toString`, `constructor`, `__proto__`, etc. as known keys.
    return Object.hasOwn(initialConfig, name) || this._customKeys.has(name);
  }

  // ─── Custom (plugin-registered) keys ───────────────────────────────────

  public register<T>(nameOrDef: string | CustomConfigDefinition<T>, defaultValue?: T): void {
    const def: CustomConfigDefinition<T> =
      typeof nameOrDef === 'string' ? { name: nameOrDef, defaultValue: defaultValue as T } : nameOrDef;
    if (this._customKeys.has(def.name)) {
      // Already registered — keep the existing value (idempotent re-register).
      return;
    }
    this._customKeys.add(def.name);
    this._customDefs.set(def.name, def as CustomConfigDefinition<unknown>);
    const bag = this._state as Record<string, unknown>;
    // Keep any value set before the plugin registered (e.g. an attribute that
    // landed first), otherwise seed the registered default. Own-property check
    // (not `=== undefined`) mirrors the nanostores `key in store` semantics, so
    // an explicit pre-registration write of `undefined` is preserved.
    if (!Object.hasOwn(bag, def.name)) {
      bag[def.name] = def.defaultValue;
    }
    this.notify();
  }

  public customDefinition(name: string): CustomConfigDefinition<unknown> | undefined {
    return this._customDefs.get(name);
  }

  public getCustom<T = unknown>(name: string): T {
    return (this._state as Record<string, unknown>)[name] as T;
  }

  public setCustom(name: string, value: unknown): void {
    const bag = this._state as Record<string, unknown>;
    if (bag[name] === value) return;
    bag[name] = value;
    this.notify();
  }

  public override destroy(): void {
    this._customKeys.clear();
    this._customDefs.clear();
    super.destroy();
  }
}
