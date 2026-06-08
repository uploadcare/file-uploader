import { getPrefixedCdnBaseAsync, isPrefixedCdnBase } from '@uploadcare/cname-prefix/async';
import type { CustomConfigDefinition } from '../../abstract/customConfigOptions';
import type { ConfigType } from '../../types/exported';
import { toKebabCase } from '../../utils/toKebabCase';
import { DEFAULT_CDN_CNAME, defaultConfig } from '../config-defaults';
import { Listeners } from '../host-subscription';

const PLAIN_CONFIG_KEYS = (Object.keys(defaultConfig) as (keyof ConfigType)[]).filter((k) => {
  const v = defaultConfig[k];
  return v === null || typeof v !== 'object';
});

/** Public catalog of plain attribute names → typed config keys. */
export const CONFIG_ATTR_MAP: Record<string, keyof ConfigType> = {};
for (const key of PLAIN_CONFIG_KEYS) {
  CONFIG_ATTR_MAP[toKebabCase(key)] = key;
  CONFIG_ATTR_MAP[String(key).toLowerCase()] = key;
}

/**
 * Pure-logic config store. Knows nothing about DOM, attributes, or Lit. The
 * UI layer (`bindConfigToElement` in `ui-adapters.ts`) bridges HTML attributes
 * + JS properties into this controller.
 *
 * Supports custom config keys via `register(name, defaultValue)` — used by
 * plugins (e.g. `unsplashAccessKey`). Custom keys live in the same backing
 * object as built-ins; reads via `getCustom`, writes via `setCustom`.
 */
export class ConfigController {
  private _values: ConfigType = { ...defaultConfig };
  private _customKeys = new Set<string>();
  private _customDefs = new Map<string, CustomConfigDefinition<unknown>>();
  private _listeners = new Listeners();
  /**
   * Latest in-flight cdnCname derivation. v1 parity: when `pubkey` or
   * `cdnCnamePrefixed` change and the current cdnCname is still the
   * default (or already a prefixed base), we resolve the prefixed CDN
   * domain for the pubkey asynchronously and write it back. A new
   * trigger aborts the previous in-flight derivation so the latest
   * pubkey wins.
   */
  private _cdnCnameAbort?: AbortController;

  public get values(): Readonly<ConfigType> {
    return this._values;
  }

  public subscribe(listener: () => void): () => void {
    return this._listeners.subscribe(listener);
  }

  public get<K extends keyof ConfigType>(key: K): ConfigType[K] {
    return this._values[key];
  }

  public set<K extends keyof ConfigType>(key: K, raw: unknown): void {
    const normalized = this._normalize(key, raw);
    if (this._values[key] === normalized) return;
    this._values[key] = normalized;
    this._listeners.notify();
    if (key === 'pubkey' || key === 'cdnCnamePrefixed') {
      this._maybeDeriveCdnCname();
    }
  }

  /**
   * v1 parity for `Config` block's `cdnCname` computed property. When
   * `pubkey` (or the prefix base) changes, and the user hasn't set a
   * custom CDN — i.e. cdnCname is still the default OR already a
   * derived prefixed base — fetch the pubkey-specific prefixed base
   * asynchronously and write it back. v1 lived in
   * `src/blocks/Config/computed-properties.ts`; in v2 the same
   * computation runs here so anywhere the controller is consumed
   * (uploader, plugins, test shims) gets a stable derived cdnCname
   * without dragging the v1 Config block along.
   */
  private _maybeDeriveCdnCname(): void {
    const pubkey = this._values.pubkey;
    if (!pubkey) return;
    const cdnCname = this._values.cdnCname;
    const cdnCnamePrefixed = this._values.cdnCnamePrefixed;
    if (cdnCname !== DEFAULT_CDN_CNAME && !isPrefixedCdnBase(cdnCname, cdnCnamePrefixed)) {
      return;
    }
    this._cdnCnameAbort?.abort();
    const abort = new AbortController();
    this._cdnCnameAbort = abort;
    getPrefixedCdnBaseAsync(pubkey, cdnCnamePrefixed)
      .then((derived) => {
        if (abort.signal.aborted) return;
        // Recheck — the user might have set a custom cdnCname (or
        // pubkey changed back to empty) while the request was in flight.
        const cname = this._values.cdnCname;
        const prefixed = this._values.cdnCnamePrefixed;
        if (cname !== DEFAULT_CDN_CNAME && !isPrefixedCdnBase(cname, prefixed)) return;
        if (!this._values.pubkey) return;
        if (cname === derived) return;
        this._values.cdnCname = derived;
        this._listeners.notify();
      })
      .catch((err) => {
        if (abort.signal.aborted) return;
        console.warn('[uploadcare] cdnCname derivation failed', err);
      });
  }

  /**
   * Normalize a raw attribute / property value against the typed
   * default. Exposed so non-controller call sites (e.g. `<uc-config>`'s
   * v1 PubSub mirror) can apply the same boolean/number coercion the
   * controller would.
   */
  public static normalize<K extends keyof ConfigType>(key: K, raw: unknown): ConfigType[K] {
    return normalizeConfigValue(key, raw);
  }

  private _normalize<K extends keyof ConfigType>(key: K, raw: unknown): ConfigType[K] {
    return normalizeConfigValue(key, raw);
  }

  // ─── Custom (plugin-registered) config keys ────────────────────────────

  public register<T>(nameOrDef: string | CustomConfigDefinition<T>, defaultValue?: T): void {
    const def: CustomConfigDefinition<T> =
      typeof nameOrDef === 'string' ? { name: nameOrDef, defaultValue: defaultValue as T } : nameOrDef;
    if (this._customKeys.has(def.name)) {
      console.warn(`[CustomConfig] Config option "${def.name}" is already registered`);
      return;
    }
    this._customKeys.add(def.name);
    this._customDefs.set(def.name, def as CustomConfigDefinition<unknown>);
    const bag = this._values as Record<string, unknown>;
    const presetValue = bag[def.name];
    if (presetValue !== undefined) {
      // Pre-existing value (e.g. attribute set before plugin loaded) — keep
      // it, but run it through normalize so the same rules apply.
      bag[def.name] = this._normalizeCustom(def.name, presetValue);
    } else {
      bag[def.name] = def.defaultValue;
    }
    this._listeners.notify();
  }

  public get customKeys(): readonly string[] {
    return [...this._customKeys];
  }

  public customDefinition(name: string): CustomConfigDefinition<unknown> | undefined {
    return this._customDefs.get(name);
  }

  public hasKey(name: string): boolean {
    return this._customKeys.has(name) || name in defaultConfig;
  }

  public getCustom<T = unknown>(name: string): T {
    return (this._values as Record<string, unknown>)[name] as T;
  }

  public setCustom(name: string, value: unknown): void {
    const bag = this._values as Record<string, unknown>;
    const normalized = this._normalizeCustom(name, value);
    if (bag[name] === normalized) return;
    bag[name] = normalized;
    this._listeners.notify();
  }

  /**
   * Reset a custom key to its registered default. If the key isn't
   * registered yet, stash `undefined` so the attribute-set path that ran
   * before registration leaves nothing behind.
   */
  public resetCustom(name: string): void {
    const bag = this._values as Record<string, unknown>;
    const def = this._customDefs.get(name);
    const next = def ? def.defaultValue : undefined;
    if (bag[name] === next) return;
    bag[name] = next;
    this._listeners.notify();
  }

  private _normalizeCustom(name: string, raw: unknown): unknown {
    const def = this._customDefs.get(name);
    if (!def?.normalize) return raw;
    try {
      return def.normalize(raw);
    } catch (err) {
      console.warn(`[v2/config] normalize() for "${name}" threw; keeping previous value.`, err);
      return (this._values as Record<string, unknown>)[name];
    }
  }

  public destroy(): void {
    this._cdnCnameAbort?.abort();
    this._cdnCnameAbort = undefined;
    this._customKeys.clear();
    this._customDefs.clear();
    this._listeners.clear();
  }
}

export { PLAIN_CONFIG_KEYS };

/**
 * Pure normalization for plain config keys. Lives outside the class so
 * `<uc-config>` and other shims can normalize values consistently
 * without spinning up a transient `ConfigController` instance.
 */
export function normalizeConfigValue<K extends keyof ConfigType>(key: K, raw: unknown): ConfigType[K] {
  const defaultValue = defaultConfig[key];
  if (raw === null || raw === undefined) return defaultValue;
  if (typeof defaultValue === 'boolean') {
    if (typeof raw === 'string') {
      if (raw === '' || raw === 'true' || raw === '1') return true as ConfigType[K];
      if (raw === 'false' || raw === '0') return false as ConfigType[K];
      return true as ConfigType[K];
    }
    return Boolean(raw) as ConfigType[K];
  }
  if (typeof defaultValue === 'number') {
    const n = typeof raw === 'number' ? raw : Number(raw);
    return (Number.isFinite(n) ? n : defaultValue) as ConfigType[K];
  }
  return raw as ConfigType[K];
}
