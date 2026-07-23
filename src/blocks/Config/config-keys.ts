import type { ConfigComplexType, ConfigPlainType, ConfigType } from '../../types';
import { toKebabCase } from '../../utils/toKebabCase';
import { initialConfig } from './initialConfig';

export const allConfigKeys = [
  // "debug" option should go first to be able to print debug messages from the very beginning
  ...new Set(['debug', ...Object.keys(initialConfig)]),
] as Array<keyof ConfigType>;

/**
 * Config keys that can't be passed as attribute (because they are object or function)
 */
export const complexConfigKeys = [
  'metadata',
  'plugins',
  'localeDefinitionOverride',
  'secureUploadsSignatureResolver',
  'secureDeliveryProxyUrlResolver',
  'iconHrefResolver',
  'fileValidators',
  'collectionValidators',
  'mediaRecorderOptions',
] as const;

export const isComplexKey = (key: keyof ConfigType): key is keyof ConfigComplexType =>
  complexConfigKeys.includes(key as unknown as (typeof complexConfigKeys)[number]);

/** Config keys that can be passed as attribute */
export const plainConfigKeys = allConfigKeys.filter((key) => !isComplexKey(key)) as (keyof ConfigPlainType)[];

/**
 * Mapping of attribute names to config keys Kebab-case and lowercase are supported. lowercase could be used by
 * frameworks like vue and react.
 */
export const builtinAttrKeyMapping: Record<string, keyof ConfigPlainType> = {
  ...Object.fromEntries(plainConfigKeys.map((key) => [toKebabCase(key), key])),
  ...Object.fromEntries(plainConfigKeys.map((key) => [key.toLowerCase(), key])),
};
