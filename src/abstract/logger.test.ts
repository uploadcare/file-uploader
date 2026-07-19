import { afterEach, describe, expect, it, vi } from 'vitest';
import { __resetLoggerForTests, logger } from './logger';

afterEach(() => {
  __resetLoggerForTests();
  vi.restoreAllMocks();
});

describe('logger (base / always-on tier)', () => {
  it('error/warn/warnOnce always print with the plain `[uc]` prefix', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logger.error('e');
    logger.warn('w');
    logger.warnOnce('wo');

    expect(error).toHaveBeenCalledWith('[uc]', 'e');
    expect(warn).toHaveBeenCalledWith('[uc]', 'w');
    expect(warn).toHaveBeenCalledWith('[uc]', 'wo');
  });

  it('warnOnce dedupes by message across repeated calls', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logger.warnOnce('same');
    logger.warnOnce('same');
    logger.warnOnce('other');

    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('the base logger`s gated tier is a no-op (never enabled)', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.log('l');
    logger.debug('d');
    logger.table('t', [{ a: 1 }]);
    expect(log).not.toHaveBeenCalled();
  });
});

describe('logger.scope', () => {
  it('prefixes always-on output with `[uc][name]`', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.scope('EventBus').warn('boom');
    expect(warn).toHaveBeenCalledWith('[uc][EventBus]', 'boom');
  });

  it('a scope without isEnabled keeps the gated tier off', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.scope('EventBus').debug('nope');
    expect(log).not.toHaveBeenCalled();
  });

  it('gated log/debug print (with the badge prefix) only when isEnabled() is true', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    let on = false;
    const scoped = logger.scope('DropArea', { isEnabled: () => on });

    scoped.debug('d1');
    expect(log).not.toHaveBeenCalled();

    on = true;
    scoped.debug('d2');
    scoped.log('l2');
    expect(log).toHaveBeenCalledWith('%c[uc][DropArea]', expect.any(String), 'd2');
    expect(log).toHaveBeenCalledWith('%c[uc][DropArea]', expect.any(String), 'l2');
  });

  it('gating is per-scope: two scopes with independent predicates do not affect each other', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const a = logger.scope('A', { isEnabled: () => true });
    const b = logger.scope('B', { isEnabled: () => false });

    a.debug('from-a');
    b.debug('from-b');

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('%c[uc][A]', expect.any(String), 'from-a');
  });

  it('debug accepts a lazy `() => args` thunk that is not evaluated when gated off', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const build = vi.fn(() => ['expensive']);
    let on = false;
    const scoped = logger.scope('X', { isEnabled: () => on });

    scoped.debug(build);
    expect(build).not.toHaveBeenCalled();

    on = true;
    scoped.debug(build);
    expect(build).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('%c[uc][X]', expect.any(String), 'expensive');
  });
});

describe('logger pretty helpers (gated)', () => {
  it('table logs a labelled header then console.table, only when enabled', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    const scoped = logger.scope('Upload', { isEnabled: () => true });

    scoped.table('upload options', { a: 1 });
    expect(log).toHaveBeenCalledWith('%c[uc][Upload]', expect.any(String), 'upload options');
    expect(table).toHaveBeenCalledWith({ a: 1 });
  });

  it('table is a no-op when disabled', () => {
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    logger.scope('Upload', { isEnabled: () => false }).table('x', {});
    expect(table).not.toHaveBeenCalled();
  });

  it('group/groupEnd and dir are gated', () => {
    const group = vi.spyOn(console, 'group').mockImplementation(() => {});
    const groupEnd = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    const dir = vi.spyOn(console, 'dir').mockImplementation(() => {});
    const scoped = logger.scope('S', { isEnabled: () => true });

    scoped.group('steps');
    scoped.dir({ nested: true });
    scoped.groupEnd();

    expect(group).toHaveBeenCalledWith('%c[uc][S]', expect.any(String), 'steps');
    expect(dir).toHaveBeenCalledWith({ nested: true });
    expect(groupEnd).toHaveBeenCalledTimes(1);
  });
});
