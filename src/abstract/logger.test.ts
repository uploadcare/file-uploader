import { afterEach, describe, expect, it, vi } from 'vitest';
import { __resetLoggerForTests, DEFAULT_LEVEL, type LogLevel, logger, maxLevel } from './logger';

afterEach(() => {
  __resetLoggerForTests();
  vi.restoreAllMocks();
});

describe('logger', () => {
  it('defaults to the `warn` level: error/warn/warnOnce print, log/debug are gated off', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // `log` and `debug` both emit via console.log (debug intentionally avoids
    // console.debug — see logger.ts — so `<uc-config debug>` stays visible).
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(logger.level).toBe(DEFAULT_LEVEL);
    logger.error('e');
    logger.warn('w');
    logger.warnOnce('wo');
    logger.log('l');
    logger.debug('d');

    expect(error).toHaveBeenCalledWith('[uc]', 'e');
    expect(warn).toHaveBeenCalledWith('[uc]', 'w');
    expect(warn).toHaveBeenCalledWith('[uc]', 'wo');
    expect(log).not.toHaveBeenCalled(); // both log + debug gated off at default
  });

  it('raising the level to `debug` prints log + debug (both via console.log)', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.configure({ level: 'debug' });
    logger.log('l');
    logger.debug('d');

    expect(log).toHaveBeenCalledWith('[uc]', 'l');
    expect(log).toHaveBeenCalledWith('[uc]', 'd');
  });

  it('`silent` suppresses everything including error/warn', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logger.configure({ level: 'silent' });
    logger.error('e');
    logger.warn('w');

    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('warnOnce dedupes by message across repeated calls', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logger.warnOnce('same');
    logger.warnOnce('same');
    logger.warnOnce('other');

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenNthCalledWith(1, '[uc]', 'same');
    expect(warn).toHaveBeenNthCalledWith(2, '[uc]', 'other');
  });

  it('log/debug accept a lazy `() => args` thunk that is not evaluated when gated', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const build = vi.fn(() => ['expensive']);

    // Gated off at the default level → thunk must NOT run.
    logger.debug(build);
    expect(build).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();

    // Enabled → thunk runs and its args are spread.
    logger.configure({ level: 'debug' });
    logger.debug(build);
    expect(build).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('[uc]', 'expensive');
  });

  it('scope() prefixes output with `[uc][name]`', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.scope('EventBus').warn('boom');
    expect(warn).toHaveBeenCalledWith('[uc][EventBus]', 'boom');
  });

  it('maxLevel returns the noisier level', () => {
    const cases: Array<[LogLevel, LogLevel, LogLevel]> = [
      ['warn', 'debug', 'debug'],
      ['debug', 'warn', 'debug'],
      ['silent', 'error', 'error'],
      ['warn', 'warn', 'warn'],
    ];
    for (const [a, b, expected] of cases) {
      expect(maxLevel(a, b)).toBe(expected);
    }
  });
});
