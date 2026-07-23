import type { CustomConfigDefinition } from './customConfigOptions';

/**
 * A fully-resolved config key descriptor — the single shape that describes EVERY
 * config option, built-in or plugin-registered. It carries the value contract
 * (`defaultValue` + `normalize`) and the attribute contract
 * (`attribute` + `toAttribute`/`fromAttribute`). The config host
 * (`WithConfig`) drives entirely off these, so it needs no knowledge of
 * plugins, "custom" configs, or the built-in static tables.
 *
 * The loose {@link CustomConfigDefinition} (optional fields, the plugin-facing
 * form) is resolved into this via {@link resolveConfigDescriptor}, which fills
 * the serialization defaults.
 */
export interface ConfigKeyDescriptor<T = unknown> {
  /** Config option name (used as DOM property and, when `attribute`, as attribute). */
  readonly name: string;
  /** Value used when the key is unset / cleared. */
  readonly defaultValue: T;
  /** Whether this key can be represented as a DOM attribute (false for objects/functions). */
  readonly attribute: boolean;
  /** Coerce ANY input (a property set with any JS value) to the typed value. */
  readonly normalize: (value: unknown) => T | undefined;
  /** Serialize a value to its attribute string; `null` ⇒ remove the attribute. */
  readonly toAttribute: (value: T) => string | null;
  /** Parse an attribute string back to a value. */
  readonly fromAttribute: (raw: string) => T | undefined;
}

/** Default attribute serializer: `null`/`undefined` remove the attribute; everything else `String()`s. */
const defaultToAttribute = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

/**
 * Resolve a loose {@link CustomConfigDefinition} into a full
 * {@link ConfigKeyDescriptor}, filling serialization defaults:
 * - `attribute` defaults to `true`,
 * - `normalize` defaults to identity,
 * - `toAttribute` defaults to `String()` (null ⇒ remove),
 * - `fromAttribute` defaults to `normalize` (attribute strings flow through the
 *   same coercion as property sets — the built-in behavior, where `asBoolean`
 *   etc. already parse `"true"`).
 */
export const resolveConfigDescriptor = <T>(def: CustomConfigDefinition<T>): ConfigKeyDescriptor<T> => {
  const normalize = def.normalize ?? ((value: unknown) => value as T);
  return {
    name: def.name,
    defaultValue: def.defaultValue,
    attribute: def.attribute ?? true,
    normalize,
    toAttribute: def.toAttribute ?? (defaultToAttribute as (value: T) => string | null),
    fromAttribute: def.fromAttribute ?? ((raw: string) => normalize(raw)),
  };
};
