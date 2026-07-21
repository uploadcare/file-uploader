import { afterEach, describe, expect, it, vi } from 'vitest';
import { type EffectHost, type EffectOptions, effect, registerHostEffects } from './effect';

afterEach(() => {
  vi.restoreAllMocks();
});

// Minimal fake host that records `updateEffect` registrations and hands back a
// disposer that notes when it ran. `isConnected` is toggled to exercise the
// connected-guard on the returned disposers.
class FakeHost {
  public isConnected = true;
  public readonly registered: Array<{ fn: () => void; options?: EffectOptions }> = [];
  public readonly disposedIndexes: number[] = [];

  public updateEffect(fn: () => void, options?: EffectOptions): () => void {
    const index = this.registered.length;
    this.registered.push({ fn, options });
    return () => this.disposedIndexes.push(index);
  }
}

const wire = (host: FakeHost): Array<() => void> => registerHostEffects(host as unknown as EffectHost);

describe('@effect / registerHostEffects', () => {
  it('registers each decorated method via updateEffect, bound to the host, forwarding options', () => {
    class Host extends FakeHost {
      public readonly ran: string[] = [];
      @effect()
      protected a(): void {
        this.ran.push('a');
      }
      @effect({ beforeUpdate: true })
      protected b(): void {
        this.ran.push('b');
      }
      protected notAnEffect(): void {
        this.ran.push('nope');
      }
    }

    const host = new Host();
    const disposers = wire(host);

    expect(host.registered).toHaveLength(2);
    expect(host.registered[1]?.options).toEqual({ beforeUpdate: true });
    expect(disposers).toHaveLength(2);

    // Running the registered fns invokes the methods with the correct `this`.
    for (const { fn } of host.registered) fn();
    expect(host.ran).toEqual(['a', 'b']);
  });

  it('walks the prototype chain and registers inherited effects', () => {
    class Base extends FakeHost {
      @effect()
      protected base(): void {}
    }
    class Sub extends Base {
      @effect()
      protected sub(): void {}
    }

    const host = new Sub();
    wire(host);

    expect(host.registered).toHaveLength(2);
  });

  it('registers an overridden effect once — the subclass override wins', () => {
    class Base extends FakeHost {
      public which = '';
      @effect()
      protected dup(): void {
        this.which = 'base';
      }
    }
    class Sub extends Base {
      @effect()
      protected override dup(): void {
        this.which = 'sub';
      }
    }

    const host = new Sub();
    wire(host);

    expect(host.registered).toHaveLength(1);
    host.registered[0]?.fn();
    expect(host.which).toBe('sub');
  });

  it('returns disposers that only fire while the host is connected', () => {
    class Host extends FakeHost {
      @effect()
      protected a(): void {}
    }

    const host = new Host();
    const [dispose] = wire(host);

    // Disconnected: the manual disposer is a no-op (the mixin auto-unwatches).
    host.isConnected = false;
    dispose?.();
    expect(host.disposedIndexes).toEqual([]);

    // Connected (a ctx re-adoption): it disposes the underlying effect.
    host.isConnected = true;
    dispose?.();
    expect(host.disposedIndexes).toEqual([0]);
  });

  it('registers nothing for a host with no @effect methods', () => {
    class Host extends FakeHost {}
    const host = new Host();
    expect(wire(host)).toHaveLength(0);
    expect(host.registered).toHaveLength(0);
  });

  it('isolates a throwing effect body so it does not escape updateEffect, and other effects still register/run', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    class Host extends FakeHost {
      public readonly ran: string[] = [];
      @effect()
      protected bad(): void {
        throw new Error('boom');
      }
      @effect()
      protected good(): void {
        this.ran.push('good');
      }
    }

    const host = new Host();
    const disposers = wire(host);

    // Both still registered (the throw happens when the wrapped fn RUNS, not at
    // registration time).
    expect(host.registered).toHaveLength(2);
    expect(disposers).toHaveLength(2);

    // Invoking the registered (wrapped) fn for the throwing method must not
    // throw, and the sibling effect still runs fine.
    expect(() => host.registered[0]?.fn()).not.toThrow();
    expect(warn).toHaveBeenCalled();
    host.registered[1]?.fn();
    expect(host.ran).toEqual(['good']);
  });

  it("uses the host's scoped `_log.warn` when reachable, instead of the module logger", () => {
    const scopedWarn = vi.fn();
    const moduleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    class Host extends FakeHost {
      public _log = { warn: scopedWarn };
      @effect()
      protected bad(): void {
        throw new Error('boom');
      }
    }

    const host = new Host();
    wire(host);
    host.registered[0]?.fn();

    expect(scopedWarn).toHaveBeenCalledTimes(1);
    expect(moduleWarn).not.toHaveBeenCalled();
  });
});
