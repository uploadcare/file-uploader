import { describe, expect, it, vi } from 'vitest';
import { initialConfig } from './initialConfig';
import { normalizeConfigValue } from './normalizeConfigValue';

describe('normalizeConfigValue', () => {
  it('returns undefined for null / undefined (the early-out, before the mapping)', () => {
    expect(normalizeConfigValue('pubkey', null)).toBeUndefined();
    expect(normalizeConfigValue('multiple', undefined)).toBeUndefined();
  });

  it('coerces primitive built-ins via their type normalizer', () => {
    expect(normalizeConfigValue('pubkey', 123)).toBe('123');
    expect(normalizeConfigValue('multiple', 'true')).toBe(true);
    expect(normalizeConfigValue('multipleMax', '5')).toBe(5);
  });

  it('normalizes the object/function/array keys (the inline-arrow mapping entries)', () => {
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

  it('falls back to the initial value and logs when a normalizer throws', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // asFunction throws on a non-function → caught → initialConfig fallback.
    expect(normalizeConfigValue('iconHrefResolver', 123)).toBe(initialConfig.iconHrefResolver);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
