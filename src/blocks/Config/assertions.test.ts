import { afterEach, expect, it, vi } from 'vitest';
import { initialConfig } from '../../abstract/config/builtin-registry';
import { __resetLoggerForTests } from '../../abstract/logger';
import { runAssertions } from './assertions';

afterEach(() => {
  vi.useRealTimers();
  __resetLoggerForTests();
});

const warningsFor = (cfg: Partial<typeof initialConfig>): string[] => {
  vi.useFakeTimers();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  runAssertions({ ...initialConfig, ...cfg });
  vi.runAllTimers();
  return warn.mock.calls.map((call) => call.join(' '));
};

// QUIRK(config): `multipartMaxAttempts` is still accepted and does nothing (NEXT-MAJOR(config) in builtin-registry.ts).
// Pinned as current behaviour, not endorsed.
it('warns once that multipartMaxAttempts is deprecated and does nothing', () => {
  const warnings = warningsFor({ multipartMaxAttempts: 5 });

  expect(warnings.filter((w) => w.includes('`multipartMaxAttempts` parameter is deprecated'))).toHaveLength(1);
});

it('says nothing about multipartMaxAttempts left at its default', () => {
  expect(warningsFor({}).some((w) => w.includes('multipartMaxAttempts'))).toBe(false);
});
