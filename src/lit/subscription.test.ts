import { describe, expect, it } from 'vitest';
import { registerHostSubscriptions, subscription } from './subscription';

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
    const teardowns = registerHostSubscriptions(host);

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
    const teardowns = registerHostSubscriptions(host);

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
    expect(registerHostSubscriptions(host)).toHaveLength(1);
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
    registerHostSubscriptions(host);
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
    expect(registerHostSubscriptions(host)).toHaveLength(0);
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
    registerHostSubscriptions(host);
    expect(ran).toEqual(['base', 'dup:sub']);
  });
});
