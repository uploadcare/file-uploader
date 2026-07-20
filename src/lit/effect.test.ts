import { describe, expect, it } from 'vitest';
import { type EffectHost, type EffectOptions, effect, registerHostEffects } from './effect';

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
});
