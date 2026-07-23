import type { ConfigComplexType, ConfigPlainType, ConfigType } from '../../types';
import { toKebabCase } from '../../utils/toKebabCase';
import { type ComplexConfigKey, complexConfigKeys as complexKeysFromRegistry, initialConfig } from './builtin-registry';

export type { ComplexConfigKey };

export const allConfigKeys = [
  // "debug" option should go first to be able to print debug messages from the very beginning
  ...new Set(['debug', ...Object.keys(initialConfig)]),
] as Array<keyof ConfigType>;

/**
 * Config keys that can't be passed as attribute (object/function values).
 * Derived from `attribute: false` entries in {@link BUILTIN_REGISTRY}.
 */
export const complexConfigKeys: readonly ComplexConfigKey[] = complexKeysFromRegistry;

export const isComplexKey = (key: keyof ConfigType): key is keyof ConfigComplexType =>
  (complexConfigKeys as readonly string[]).includes(key);

/** Config keys that can be passed as attribute */
export const plainConfigKeys = allConfigKeys.filter((key) => !isComplexKey(key)) as (keyof ConfigPlainType)[];

/**
 * Mapping of attribute names to config keys. Kebab-case and lowercase are supported;
 * lowercase is used by frameworks like Vue and React.
 */
export const builtinAttrKeyMapping: Record<string, keyof ConfigPlainType> = {
  ...Object.fromEntries(plainConfigKeys.map((key) => [toKebabCase(key), key])),
  ...Object.fromEntries(plainConfigKeys.map((key) => [key.toLowerCase(), key])),
};
