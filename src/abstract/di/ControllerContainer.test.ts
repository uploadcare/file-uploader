import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTAINER, ControllerContainer, resolveToken, type Token } from './ControllerContainer';

describe('resolveToken', () => {
  it('returns a class token as-is', () => {
    class A {}
    expect(resolveToken(A)).toBe(A);
  });

  it('invokes a thunk token to get the class', () => {
    class A {}
    const thunk: Token<A> = () => A;
    expect(resolveToken(thunk)).toBe(A);
  });
});

describe('ControllerContainer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lazily constructs a singleton per token and caches it', () => {
    let count = 0;
    class A {
      public readonly id = ++count;
    }
    const container = new ControllerContainer();

    const first = container.get(A);
    const second = container.get(A);

    expect(first).toBeInstanceOf(A);
    expect(second).toBe(first);
    expect(count).toBe(1);
  });

  it('tags each built instance with the container', () => {
    class A {}
    const container = new ControllerContainer();

    const inst = container.get(A) as A & { [CONTAINER]?: ControllerContainer };

    expect(inst[CONTAINER]).toBe(container);
  });

  it('resolves the same instance through a class token and its thunk', () => {
    class A {}
    const container = new ControllerContainer();

    const viaClass = container.get(A);
    const viaThunk = container.get(() => A);

    expect(viaThunk).toBe(viaClass);
  });

  it('calls init() after tagging and caching', () => {
    const seen: { tagged: boolean; cached: boolean } = { tagged: false, cached: false };
    class A {
      public init(): void {
        const self = this as A & { [CONTAINER]?: ControllerContainer };
        seen.tagged = self[CONTAINER] === container;
        seen.cached = container.has(A);
      }
    }
    const container = new ControllerContainer();

    container.get(A);

    expect(seen.tagged).toBe(true);
    expect(seen.cached).toBe(true);
  });

  it('does not require an init() method', () => {
    class A {}
    const container = new ControllerContainer();
    expect(() => container.get(A)).not.toThrow();
  });

  it('bind() overrides construction with a factory', () => {
    class A {
      public source = 'ctor';
    }
    const container = new ControllerContainer();
    container.bind(A, () => {
      const a = new A();
      a.source = 'factory';
      return a;
    });

    expect(container.get(A).source).toBe('factory');
  });

  it('passes the container into the bind factory', () => {
    class Dep {}
    class A {
      public dep: Dep | null = null;
    }
    const container = new ControllerContainer();
    container.bind(A, (c) => {
      const a = new A();
      a.dep = c.get(Dep);
      return a;
    });

    expect(container.get(A).dep).toBe(container.get(Dep));
  });

  it('rolls back a failed init() so a later get() retries construction', () => {
    let attempts = 0;
    let destroyed = 0;
    class A {
      public init(): void {
        attempts++;
        if (attempts === 1) {
          throw new Error('init boom');
        }
      }
      public destroy(): void {
        destroyed++;
      }
    }
    const container = new ControllerContainer();

    expect(() => container.get(A)).toThrow(/init boom/);
    // The partially-initialized singleton must not linger.
    expect(container.has(A)).toBe(false);
    expect(destroyed).toBe(1); // best-effort teardown ran on the failed instance

    // A later get() retries construction rather than returning the broken one.
    const inst = container.get(A);
    expect(inst).toBeInstanceOf(A);
    expect(attempts).toBe(2);
    expect(container.has(A)).toBe(true);

    // The rolled-back instance was removed from #order, so dispose() tears down
    // only the successful instance (destroyed 1 → 2).
    container.dispose();
    expect(destroyed).toBe(2);
  });

  it('disposes an instance lazily resolved during another destroy()', () => {
    const order: string[] = [];
    class Late {
      public destroy(): void {
        order.push('Late');
      }
    }
    class Early {
      #container: ControllerContainer;
      public constructor(c: ControllerContainer) {
        this.#container = c;
      }
      public destroy(): void {
        // Touch a not-yet-resolved peer during teardown: it is appended to
        // #order mid-dispose. Draining the live list must still destroy it.
        this.#container.get(Late);
        order.push('Early');
      }
    }
    const container = new ControllerContainer();
    container.bind(Early, (c) => new Early(c));
    container.get(Early);

    container.dispose();

    expect(order).toEqual(['Early', 'Late']);
    expect(container.has(Late)).toBe(false);
  });

  it('throws when bind() is called after resolution', () => {
    class A {}
    const container = new ControllerContainer();
    container.get(A);

    expect(() => container.bind(A, () => new A())).toThrow(/bind\(A\) after resolution/);
  });

  it('throws on a construction cycle', () => {
    class Cyclic {}
    const container = new ControllerContainer();
    container.bind(Cyclic, (c) => c.get(Cyclic));

    expect(() => container.get(Cyclic)).toThrow(/controller cycle at Cyclic/);
  });

  it('clears the resolving guard so a later get() still works after a cycle throw', () => {
    class Cyclic {}
    const container = new ControllerContainer();
    let first = true;
    container.bind(Cyclic, (c) => {
      if (first) {
        first = false;
        return c.get(Cyclic);
      }
      return new Cyclic();
    });

    expect(() => container.get(Cyclic)).toThrow(/cycle/);
    // The bound factory already threw once; a fresh, non-recursive resolution
    // must not be blocked by a stale resolving-guard entry.
    expect(container.get(Cyclic)).toBeInstanceOf(Cyclic);
  });

  it('has() reflects whether a token was resolved', () => {
    class A {}
    const container = new ControllerContainer();

    expect(container.has(A)).toBe(false);
    container.get(A);
    expect(container.has(A)).toBe(true);
  });

  it('tracks consumers for reference counting', () => {
    const container = new ControllerContainer();
    const consumerA = {};
    const consumerB = {};

    expect(container.isUnreferenced()).toBe(true);
    container.addConsumer(consumerA);
    container.addConsumer(consumerB);
    expect(container.isUnreferenced()).toBe(false);

    container.removeConsumer(consumerA);
    expect(container.isUnreferenced()).toBe(false);
    container.removeConsumer(consumerB);
    expect(container.isUnreferenced()).toBe(true);
  });

  it('disposes instances in reverse insertion order', () => {
    const order: string[] = [];
    class A {
      public destroy(): void {
        order.push('A');
      }
    }
    class B {
      public destroy(): void {
        order.push('B');
      }
    }
    class C {
      public destroy(): void {
        order.push('C');
      }
    }
    const container = new ControllerContainer();
    container.get(A);
    container.get(B);
    container.get(C);

    container.dispose();

    expect(order).toEqual(['C', 'B', 'A']);
  });

  it('skips instances without a destroy() method', () => {
    class A {}
    const container = new ControllerContainer();
    container.get(A);

    expect(() => container.dispose()).not.toThrow();
  });

  it('isolates a throwing destroy() and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const order: string[] = [];
    class Bad {
      public destroy(): void {
        throw new Error('boom');
      }
    }
    class Good {
      public destroy(): void {
        order.push('Good');
      }
    }
    const container = new ControllerContainer();
    container.get(Good);
    container.get(Bad);

    expect(() => container.dispose()).not.toThrow();
    // Bad is disposed first (reverse order); Good must still run afterwards.
    expect(order).toEqual(['Good']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Bad.destroy() threw'), expect.any(Error));
  });

  it('resets its state after dispose()', () => {
    class A {}
    const container = new ControllerContainer();
    const consumer = {};
    container.addConsumer(consumer);
    container.get(A);

    container.dispose();

    expect(container.has(A)).toBe(false);
    expect(container.isUnreferenced()).toBe(true);
    // A fresh construction is possible again, and bind() is valid once more.
    expect(() => container.bind(A, () => new A())).not.toThrow();
  });
});

describe('ControllerContainer.getOrNull', () => {
  it('returns null for a token that has not been constructed', () => {
    class A {}
    const container = new ControllerContainer();
    expect(container.getOrNull(A)).toBeNull();
    // A bare `bind` (no `get`) does NOT count as constructed — getOrNull must
    // not construct it either.
    class B {}
    container.bind(B, () => new B());
    expect(container.getOrNull(B)).toBeNull();
    expect(container.has(B)).toBe(false);
  });

  it('returns the instance once constructed', () => {
    class A {}
    const container = new ControllerContainer();
    const a = container.get(A);
    expect(container.getOrNull(A)).toBe(a);
  });

  it('resolves a thunk token', () => {
    class A {}
    const thunk: Token<A> = () => A;
    const container = new ControllerContainer();
    expect(container.getOrNull(thunk)).toBeNull();
    const a = container.get(thunk);
    expect(container.getOrNull(thunk)).toBe(a);
  });
});

describe('ControllerContainer.whenController', () => {
  it('fires synchronously when the token is already constructed', () => {
    class A {}
    const container = new ControllerContainer();
    const a = container.get(A);
    const cb = vi.fn();
    const off = container.whenController(A, cb);
    expect(cb).toHaveBeenCalledWith(a);
    expect(cb).toHaveBeenCalledTimes(1);
    off(); // no-op unsubscribe
  });

  it('fires when the token is constructed later, with the initialized instance', () => {
    const order: string[] = [];
    class A {
      public init(): void {
        order.push('init');
      }
    }
    const container = new ControllerContainer();
    const cb = vi.fn(() => order.push('waiter'));
    container.whenController(A, cb);
    expect(cb).not.toHaveBeenCalled();

    const a = container.get(A);
    expect(cb).toHaveBeenCalledWith(a);
    // The waiter runs AFTER init(), so it sees a fully constructed instance.
    expect(order).toEqual(['init', 'waiter']);
  });

  it('fires each of several waiters exactly once, then not again on re-resolution', () => {
    class A {}
    const container = new ControllerContainer();
    const a = vi.fn();
    const b = vi.fn();
    container.whenController(A, a);
    container.whenController(A, b);

    const inst = container.get(A);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    // A subsequent get() returns the cache and must NOT re-fire the (already
    // flushed) waiters.
    expect(container.get(A)).toBe(inst);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe cancels a still-pending waiter', () => {
    class A {}
    const container = new ControllerContainer();
    const cb = vi.fn();
    const off = container.whenController(A, cb);
    off();
    container.get(A);
    expect(cb).not.toHaveBeenCalled();
  });

  it('unsubscribing one of two pending waiters leaves the other live', () => {
    class A {}
    const container = new ControllerContainer();
    const cancelled = vi.fn();
    const kept = vi.fn();
    const offCancelled = container.whenController(A, cancelled);
    container.whenController(A, kept);
    offCancelled();

    container.get(A);
    expect(cancelled).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });

  it('isolates a throwing waiter so the others still fire, and does not bubble out of get()', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    class A {}
    const container = new ControllerContainer();
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    container.whenController(A, bad);
    container.whenController(A, good);

    expect(() => container.get(A)).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('whenController waiter for A threw'), expect.any(Error));
    warn.mockRestore();
  });

  it('resolves a bound factory token and fires its waiter', () => {
    class A {
      public constructor(public readonly tag: string) {}
    }
    const container = new ControllerContainer();
    container.bind(A, () => new A('bound'));
    const cb = vi.fn();
    container.whenController(A, cb);
    expect(cb).not.toHaveBeenCalled();

    const a = container.get(A);
    expect(a.tag).toBe('bound');
    expect(cb).toHaveBeenCalledWith(a);
  });

  it('dispose() clears pending waiters so a rebuilt token does not fire a stale waiter', () => {
    class A {}
    const container = new ControllerContainer();
    const cb = vi.fn();
    container.whenController(A, cb);
    container.dispose();
    // After dispose the container is reusable; a fresh get() must not fire the
    // waiter registered before dispose.
    container.get(A);
    expect(cb).not.toHaveBeenCalled();
  });
});
