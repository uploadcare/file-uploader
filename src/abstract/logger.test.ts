import { afterEach, describe, expect, it, vi } from 'vitest';
import { __resetLoggerForTests, CTX_BADGE_STYLE, lazy, logger, SCOPE_BADGE_STYLE, UC_BADGE_STYLE } from './logger';

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
    expect(log).not.toHaveBeenCalled();
  });
});

describe('logger.scope', () => {
  it('prefixes always-on output with `[uc][name]`', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.scope('EventBus').warn('boom');
    expect(warn).toHaveBeenCalledWith('[uc][EventBus]', 'boom');
  });

  it('a scope without isVerbose keeps the gated tier off', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.scope('EventBus').debug('nope');
    expect(log).not.toHaveBeenCalled();
  });

  it('gated log/debug print (with the badge prefix) only when isVerbose() is true', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    let on = false;
    const scoped = logger.scope('DropArea', { isVerbose: () => on });

    scoped.debug('d1');
    expect(log).not.toHaveBeenCalled();

    on = true;
    scoped.debug('d2');
    scoped.log('l2');
    expect(log).toHaveBeenCalledWith('%c uc %c DropArea %c', UC_BADGE_STYLE, SCOPE_BADGE_STYLE, '', 'd2');
    expect(log).toHaveBeenCalledWith('%c uc %c DropArea %c', UC_BADGE_STYLE, SCOPE_BADGE_STYLE, '', 'l2');
  });

  it('inserts the resolved ctx-name into the prefix, between `[uc]` and the scope', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    let ctx: string | undefined = 'my-uploader';
    const scoped = logger.scope('secure-uploads', { isVerbose: () => true, ctxName: () => ctx });

    scoped.warn('boom');
    scoped.debug('d');
    expect(warn).toHaveBeenCalledWith('[uc][my-uploader][secure-uploads]', 'boom');
    expect(log).toHaveBeenCalledWith(
      '%c uc %c my-uploader %c secure-uploads %c',
      UC_BADGE_STYLE,
      CTX_BADGE_STYLE,
      SCOPE_BADGE_STYLE,
      '',
      'd',
    );

    // Resolved lazily per call: when no ctx is available the segment is omitted.
    ctx = undefined;
    scoped.warn('later');
    expect(warn).toHaveBeenCalledWith('[uc][secure-uploads]', 'later');
  });

  it('gating is per-scope: two scopes with independent predicates do not affect each other', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const a = logger.scope('A', { isVerbose: () => true });
    const b = logger.scope('B', { isVerbose: () => false });

    a.debug('from-a');
    b.debug('from-b');

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('%c uc %c A %c', UC_BADGE_STYLE, SCOPE_BADGE_STYLE, '', 'from-a');
  });

  it('debug accepts a `lazy(() => args)` payload that is not built when gated off', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const build = vi.fn(() => ['expensive']);
    let on = false;
    const scoped = logger.scope('X', { isVerbose: () => on });

    scoped.debug(lazy(build));
    expect(build).not.toHaveBeenCalled();

    on = true;
    scoped.debug(lazy(build));
    expect(build).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('%c uc %c X %c', UC_BADGE_STYLE, SCOPE_BADGE_STYLE, '', 'expensive');
  });

  it('a bare function arg is logged as a value and NEVER invoked (no auto-thunk)', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const fn = vi.fn(() => ['should-not-run']);
    const scoped = logger.scope('x', { isVerbose: () => true });

    scoped.debug(fn);

    // The logger is public plugin surface: a sole function must be treated as a
    // value to print, not silently invoked (only `lazy(...)` is built).
    expect(fn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('%c uc %c x %c', UC_BADGE_STYLE, SCOPE_BADGE_STYLE, '', fn);
  });
});
