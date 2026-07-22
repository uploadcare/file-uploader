import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounced, registerHostRateLimited, throttled } from './rate-limited-method';

// A minimal `ChildBlock`-shaped host: the decorator reads only `containerOrNull`
// (a truthy container means "adopted"). Methods are public here purely so the
// tests can invoke them without bracket access.
class Host {
  public containerOrNull: object | null = {};
  public calls: string[] = [];

  @throttled(100)
  public onThrottled(tag: string): void {
    this.calls.push(`t:${tag}`);
  }

  @debounced(100)
  public onDebounced(tag: string): void {
    this.calls.push(`d:${tag}`);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('@throttled / @debounced', () => {
  it('exposes a stable bound reference per instance (safe to hand to observe())', () => {
    const host = new Host();
    const ref1 = host.onThrottled;
    const ref2 = host.onThrottled;
    expect(ref1).toBe(ref2); // cached own-property after first getter read
    // Runtime shape is the limiter (with `cancel`); the declared type stays the
    // method signature, so read `cancel` through a cast at this test boundary.
    expect(typeof (ref1 as unknown as { cancel: () => void }).cancel).toBe('function');

    // A second instance gets its own limiter, not the first's.
    const other = new Host();
    expect(other.onThrottled).not.toBe(ref1);
  });

  it('throttles: leading call runs immediately, bursts collapse', () => {
    const host = new Host();
    host.onThrottled('a'); // leading edge → runs now
    host.onThrottled('b');
    host.onThrottled('c');
    expect(host.calls).toEqual(['t:a']);

    vi.advanceTimersByTime(100); // trailing edge → one more
    expect(host.calls).toEqual(['t:a', 't:c']);
  });

  it('debounces: only the trailing call runs after the wait', () => {
    const host = new Host();
    host.onDebounced('a');
    host.onDebounced('b');
    expect(host.calls).toEqual([]); // nothing yet

    vi.advanceTimersByTime(100);
    expect(host.calls).toEqual(['d:b']);
  });

  it('adopted-guard: a tick that fires after release no-ops (body never runs)', () => {
    const host = new Host();
    host.onDebounced('a'); // scheduled while adopted
    host.containerOrNull = null; // released before the timer fires

    vi.advanceTimersByTime(100);
    expect(host.calls).toEqual([]); // guard bailed — @inject reads would be unsafe

    // Re-adopting and firing again runs normally (same limiter reused).
    host.containerOrNull = {};
    host.onDebounced('b');
    vi.advanceTimersByTime(100);
    expect(host.calls).toEqual(['d:b']);
  });
});

describe('registerHostRateLimited', () => {
  it('returns one teardown that cancels every pending limiter on the host', () => {
    const host = new Host();
    const [teardown] = registerHostRateLimited(host);
    expect(teardown).toBeTypeOf('function');

    host.onDebounced('a'); // pending
    teardown!(); // release → cancel
    vi.advanceTimersByTime(100);
    expect(host.calls).toEqual([]); // pending debounce was cancelled
  });

  it('reuses the same limiter across a release cycle (re-adoption does not re-create)', () => {
    const host = new Host();
    const ref = host.onDebounced;
    const [teardown] = registerHostRateLimited(host);

    host.onDebounced('a');
    teardown!(); // cancel pending
    expect(host.onDebounced).toBe(ref); // same cached bound limiter

    host.onDebounced('b'); // works after the cancel
    vi.advanceTimersByTime(100);
    expect(host.calls).toEqual(['d:b']);
  });

  it('returns an empty array for a host with no rate-limited methods', () => {
    class Plain {
      public containerOrNull: object | null = {};
    }
    expect(registerHostRateLimited(new Plain())).toEqual([]);
  });
});
