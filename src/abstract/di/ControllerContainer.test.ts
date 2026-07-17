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
