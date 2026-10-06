import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigType } from '../../types/exported';
import { CONFIG_VALUES } from './__tests__/configValues';
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
   * The sweep above never reaches an option defaulting to `null`, because
   * `null` short-circuits before the validator runs — and those are the
   * options with the least trivial shapes, which is how `authToken` came to
   * reject the provider form its own type allows.
   *
   * `CONFIG_VALUES` is the table the element-level sweep uses, so both layers
   * are held to the same values instead of two lists that drift.
   */
  describe('accepts every value its type describes', () => {
    for (const key of keys) {
      it.each(CONFIG_VALUES[key].map((value) => [value]))(`${key} = %o`, (value) => {
        const normalized = normalizeConfigValue(key, value);

        if (value === null) {
          expect(normalized).toBeUndefined();
        } else {
          expect(normalized).toEqual(value);
        }
        expect(console.error).not.toHaveBeenCalled();
      });
    }
  });

  // Every shape `authToken` accepts is in `CONFIG_VALUES`, swept above. What
  // the table cannot express is the other half of the contract: a plain token,
  // a resolver and a `{ getToken }` provider are the only shapes, and anything
  // else has to be turned away rather than sent to the Upload API.
  describe('authToken rejects what is not a token, a resolver or a provider', () => {
    it.each([42, [], {}, { getToken: 'nope' }, true])('falls back to the default for %p', (value) => {
      expect(normalizeConfigValue('authToken', value)).toBe(initialConfig.authToken);
      expect(console.error).toHaveBeenCalled();
    });
  });
});
