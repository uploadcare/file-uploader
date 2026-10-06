import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigType } from '../../types/exported';
import { initialConfig } from './initialConfig';
import { normalizeConfigValue } from './normalizeConfigValue';

const keys = Object.keys(initialConfig) as (keyof ConfigType)[];

describe('normalizeConfigValue', () => {
  beforeEach(() => {
    // A rejected value is reported, not thrown, so a failing validator is
    // otherwise invisible to a test.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('covers every config key', () => {
    // `mapping` is keyed by `keyof ConfigType`, so a new option without a
    // validator is a type error. This catches the reverse: a key that exists
    // in the type but never reaches `initialConfig`, which would leave the
    // sweeps below silently skipping it.
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(normalizeConfigValue(key, initialConfig[key])).toBeDefined;
    }
  });

  describe('accepts its own defaults', () => {
    // The whole point: a validator that rejects the value the option ships
    // with is rejecting a value its own type allows.
    it.each(keys)('%s', (key) => {
      const value = initialConfig[key];
      const normalized = normalizeConfigValue(key, value);

      if (value === null || typeof value === 'undefined') {
        expect(normalized).toBeUndefined();
      } else {
        expect(normalized).toEqual(value);
      }
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('null and undefined mean "unset" for every key', () => {
    it.each(keys)('%s', (key) => {
      expect(normalizeConfigValue(key, null)).toBeUndefined();
      expect(normalizeConfigValue(key, undefined)).toBeUndefined();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  /**
   * The sweep above never reaches these: their default is `null`, which
   * short-circuits before the validator runs. They are also the options with
   * the least trivial shapes, which is how `authToken` came to reject the
   * provider form its own type allows. One real value each, taken from the
   * declared type.
   */
  describe('accepts a valid value for every option defaulting to null', () => {
    const nullDefaulted: { [K in keyof ConfigType]?: ConfigType[K][] } = {
      metadata: [{ subject: 'id-card' }, () => ({ subject: 'id-card' })],
      tags: [['one', 'two'], () => ['one']],
      localeDefinitionOverride: [{ en: { 'upload-file': 'Upload' } }],
      secureUploadsSignatureResolver: [async () => ({ secureSignature: 'sig', secureExpire: 'exp' })],
      authToken: ['eyJ', () => 'eyJ', { getToken: () => 'eyJ' }],
      secureDeliveryProxyUrlResolver: [async () => 'https://proxy.example/{previewUrl}'],
      iconHrefResolver: [(iconName: string) => `#icon-${iconName}`],
      defaultCameraMode: ['photo', 'video'],
      enableVideoRecording: [true, false],
      maxVideoRecordingDuration: [30],
      mediaRecorderOptions: [{ mimeType: 'video/webm' }],
      cloudImageEditorMaskHref: ['https://example.com/mask.svg'],
    };

    it('lists every one of them, so a new nullable option cannot slip past', () => {
      const actual = keys.filter((key) => initialConfig[key] === null).sort();
      expect(Object.keys(nullDefaulted).sort()).toEqual(actual);
    });

    for (const [key, values] of Object.entries(nullDefaulted)) {
      it.each(values as unknown[])(`${key}: %p`, (value) => {
        expect(normalizeConfigValue(key as keyof ConfigType, value)).toEqual(value);
        expect(console.error).not.toHaveBeenCalled();
      });
    }
  });

  describe('authToken', () => {
    it('accepts a plain token', () => {
      expect(normalizeConfigValue('authToken', 'eyJ.plain.sig')).toBe('eyJ.plain.sig');
    });

    it('accepts a resolver', () => {
      const resolver = () => 'eyJ';
      expect(normalizeConfigValue('authToken', resolver)).toBe(resolver);
    });

    it('accepts a provider, so a configured cache can be passed straight in', () => {
      // `AuthTokenCache` from `@uploadcare/signed-uploads/client` is one of
      // these. Dropping it here would leave uploads unsigned.
      const provider = { getToken: async () => 'eyJ', invalidate: () => {} };
      expect(normalizeConfigValue('authToken', provider)).toBe(provider);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('accepts a provider without invalidate, which is optional', () => {
      const provider = { getToken: () => 'eyJ' };
      expect(normalizeConfigValue('authToken', provider)).toBe(provider);
    });

    it.each([42, [], {}, { getToken: 'nope' }, true])('falls back to the default for %p', (value) => {
      expect(normalizeConfigValue('authToken', value)).toBe(initialConfig.authToken);
      expect(console.error).toHaveBeenCalled();
    });
  });
});
