import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeConfigValue } from './builtin-registry';

// The 1.x boolean rule, as v1 shipped it (main: src/blocks/Config/validatorsType.ts `asBoolean`, and
// normalizeConfigValue.ts, which logs a rejected value and falls back to the option's default). The same rule applies
// to an attribute string and to a property write.
describe('boolean options keep the v1 parsing', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // `imgOnly` defaults to false, `multiple` to true, so a fallback to the default shows on both sides.
  it.each([
    ['', true],
    ['true', true],
    ['false', false],
    [true, true],
    [false, false],
  ] as const)('accepts %o as %o', (value, expected) => {
    expect(normalizeConfigValue('imgOnly', value)).toBe(expected);
    expect(normalizeConfigValue('multiple', value)).toBe(expected);
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([
    '0',
    '1',
    'no',
    'yes',
    'FALSE',
    'TRUE',
    'off',
    'value',
    ' ',
    0,
    1,
  ])('rejects %o: logs an error and keeps the default', (value) => {
    expect(normalizeConfigValue('imgOnly', value)).toBe(false);
    expect(normalizeConfigValue('multiple', value)).toBe(true);
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it('store="0" keeps the "auto" default instead of storing', () => {
    expect(normalizeConfigValue('store', '0')).toBe('auto');
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(normalizeConfigValue('store', 'auto')).toBe('auto');
    expect(normalizeConfigValue('store', 'false')).toBe(false);
    expect(normalizeConfigValue('store', '')).toBe(true);
  });
});
