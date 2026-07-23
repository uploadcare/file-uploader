import { type ConfigKeyDescriptor, resolveConfigDescriptor } from '../../abstract/config-descriptor';
import type { ConfigType } from '../../types';
import { allConfigKeys, isComplexKey } from './config-keys';
import { initialConfig } from './initialConfig';
import { normalizeConfigValue } from './normalizeConfigValue';

/**
 * The resolved descriptor for every BUILT-IN config option, derived once from
 * the existing static tables — `initialConfig` (defaults), `normalizeConfigValue`
 * (per-key value coercion), and `isComplexKey` (attribute-representable or not).
 * Serialization is explicit per key (`toAttribute`/`fromAttribute`, filled by
 * `resolveConfigDescriptor`) and wire-format-identical to the previous
 * `String(value)` / normalize-on-attribute behavior.
 *
 * Built-in descriptors are ctx-independent, so this Map is a shared module-level
 * constant — `ConfigController` overlays only the per-ctx custom (plugin)
 * descriptors on top.
 */
export const BUILTIN_DESCRIPTORS: ReadonlyMap<string, ConfigKeyDescriptor> = new Map(
  allConfigKeys.map((key): [string, ConfigKeyDescriptor] => [
    key,
    // The per-key descriptor is `ConfigKeyDescriptor<ConfigType[key]>`; the map
    // erases the value type (accessed dynamically by string key), so widen at
    // this boundary — the descriptor's own functions handle their value type.
    resolveConfigDescriptor({
      name: key,
      defaultValue: initialConfig[key],
      attribute: !isComplexKey(key),
      normalize: (value: unknown) => normalizeConfigValue(key, value) as ConfigType[typeof key],
    }) as unknown as ConfigKeyDescriptor,
  ]),
);
