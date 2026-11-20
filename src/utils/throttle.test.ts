import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { throttle } from './throttle';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('throttle', () => {
  it('runs a call at once when the wait has passed, and defers the rest to its end', () => {
    vi.setSystemTime(1000);
    const fn = vi.fn();
    const throttled = throttle(fn, 10);
    throttled(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith(1);
    throttled(2);
    throttled(3);
    expect(fn).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10);
    expect(fn).toHaveBeenLastCalledWith(3);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancel drops the deferred call', () => {
    vi.setSystemTime(1000);
    const fn = vi.fn();
    const throttled = throttle(fn, 10);
    throttled(1);
    throttled(2);
    throttled.cancel();
    vi.advanceTimersByTime(10);
    expect(fn).toHaveBeenCalledOnce();
  });
});
