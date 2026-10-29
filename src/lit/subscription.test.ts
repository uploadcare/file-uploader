import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../abstract/logger';
import { registerHostSubscriptions, subscription } from './subscription';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('@subscription / registerHostSubscriptions', () => {
  it('runs each decorated method once and collects the returned teardowns', () => {
    const order: string[] = [];
    class Host {
      @subscription()
      protected a(): () => void {
        order.push('run:a');
        return () => order.push('down:a');
      }
      @subscription()
      protected b(): () => void {
        order.push('run:b');
        return () => order.push('down:b');
      }
    }

    const host = new Host();
    const teardowns = registerHostSubscriptions(host, logger);

    expect(order).toEqual(['run:a', 'run:b']);
    expect(teardowns).toHaveLength(2);

    for (const t of teardowns) t();
    expect(order).toEqual(['run:a', 'run:b', 'down:a', 'down:b']);
  });

  it('flattens an array of teardowns returned by a method', () => {
    const order: string[] = [];
    class Host {
      @subscription()
      protected many(): Array<() => void> {
        return [() => order.push('a'), () => order.push('b')];
      }
    }

    const host = new Host();
    const teardowns = registerHostSubscriptions(host, logger);

    expect(teardowns).toHaveLength(2);
    for (const t of teardowns) t();
    expect(order).toEqual(['a', 'b']);
  });

  it('ignores non-function entries in a returned array', () => {
    class Host {
      @subscription()
      protected mixed(): unknown {
        return [() => {}, undefined, null];
      }
    }
    const host = new Host();
    expect(registerHostSubscriptions(host, logger)).toHaveLength(1);
  });

  it('binds `this` to the host inside the subscription method', () => {
    class Host {
      public wired = '';
      @subscription()
      protected a(): void {
        this.wired = 'host';
      }
    }
    const host = new Host();
    registerHostSubscriptions(host, logger);
    expect(host.wired).toBe('host');
  });

  it('skips methods that return a non-function (no teardown to track)', () => {
    class Host {
      @subscription()
      protected a(): void {
        // nothing to tear down
      }
    }
    const host = new Host();
    expect(registerHostSubscriptions(host, logger)).toHaveLength(0);
  });

  it('walks the prototype chain and registers an override once (subclass wins)', () => {
    const ran: string[] = [];
    class Base {
      @subscription()
      protected base(): void {
        ran.push('base');
      }
      @subscription()
      protected dup(): void {
        ran.push('dup:base');
      }
    }
    class Sub extends Base {
      @subscription()
      protected override dup(): void {
        ran.push('dup:sub');
      }
    }

    const host = new Sub();
    registerHostSubscriptions(host, logger);
    expect(ran).toEqual(['base', 'dup:sub']);
  });

  it('isolates a throwing method so the rest still register and already-collected teardowns are kept', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const teardownA = vi.fn();
    const teardownC = vi.fn();
    class Host {
      @subscription()
      protected a(): () => void {
        return teardownA;
      }
      @subscription()
      protected b(): () => void {
        throw new Error('boom');
      }
      @subscription()
      protected c(): () => void {
        return teardownC;
      }
    }

    const host = new Host();
    let teardowns: Array<() => void> = [];
    expect(() => {
      teardowns = registerHostSubscriptions(host, logger);
    }).not.toThrow();

    // The throwing method (b) is contained; a and c still registered.
    expect(teardowns).toHaveLength(2);
    expect(warn).toHaveBeenCalled();

    for (const t of teardowns) t();
    expect(teardownA).toHaveBeenCalledTimes(1);
    expect(teardownC).toHaveBeenCalledTimes(1);
  });

  it('warns through the logger it is given, not the root logger', () => {
    const scopedWarn = vi.fn();
    const moduleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    class Host {
      @subscription()
      protected bad(): void {
        throw new Error('boom');
      }
    }

    const host = new Host();
    registerHostSubscriptions(host, { warn: scopedWarn });

    expect(scopedWarn).toHaveBeenCalledTimes(1);
    expect(moduleWarn).not.toHaveBeenCalled();
  });
});
