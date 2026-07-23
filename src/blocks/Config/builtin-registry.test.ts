import { describe, expect, it, vi } from 'vitest';
import { BUILTIN_REGISTRY, complexConfigKeys, initialConfig, normalizeConfigValue } from './builtin-registry';

describe('BUILTIN_REGISTRY', () => {
  it('stays exhaustive with ConfigType / initialConfig', () => {
    for (const key of Object.keys(initialConfig) as (keyof typeof initialConfig)[]) {
      expect(BUILTIN_REGISTRY[key], `missing registry entry for ${key}`).toBeDefined();
      expect(BUILTIN_REGISTRY[key].default).toBe(initialConfig[key]);
    }
    expect(Object.keys(BUILTIN_REGISTRY).sort()).toEqual(Object.keys(initialConfig).sort());
  });

  it('derives complexConfigKeys from attribute:false registry entries', () => {
    expect(complexConfigKeys).toContain('metadata');
    expect(complexConfigKeys).toContain('mediaRecorderOptions');
    expect(complexConfigKeys).toHaveLength(9);
    for (const key of complexConfigKeys) {
      expect(BUILTIN_REGISTRY[key].attribute).toBe(false);
    }
  });
});

describe('normalizeConfigValue', () => {
  it('returns undefined for null / undefined (the early-out, before coerce)', () => {
    expect(normalizeConfigValue('pubkey', null)).toBeUndefined();
    expect(normalizeConfigValue('multiple', undefined)).toBeUndefined();
  });

  it('coerces primitive built-ins via their type normalizer', () => {
    expect(normalizeConfigValue('pubkey', 123)).toBe('123');
    expect(normalizeConfigValue('multiple', 'true')).toBe(true);
    expect(normalizeConfigValue('multipleMax', '5')).toBe(5);
  });

  it('normalizes object / function / array keys', () => {
    const override = { en: { 'file-uploader': { key: 'value' } } };
    expect(normalizeConfigValue('localeDefinitionOverride', override)).toEqual(override);

    const sigResolver = () => Promise.resolve({ secureSignature: 's', secureExpire: 'e' });
    expect(normalizeConfigValue('secureUploadsSignatureResolver', sigResolver)).toBe(sigResolver);

    const proxyResolver = () => 'https://proxy';
    expect(normalizeConfigValue('secureDeliveryProxyUrlResolver', proxyResolver)).toBe(proxyResolver);

    const iconResolver = () => 'href';
    expect(normalizeConfigValue('iconHrefResolver', iconResolver)).toBe(iconResolver);

    const plugins = [{ name: 'x' }] as never;
    expect(normalizeConfigValue('plugins', plugins)).toEqual(plugins);
  });

  it('falls back to the initial value and logs when a coerce throws', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // asFunction throws on a non-function → caught → initialConfig fallback.
    expect(normalizeConfigValue('iconHrefResolver', 123)).toBe(initialConfig.iconHrefResolver);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
