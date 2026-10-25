import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('debounce', () => {
  it('calls once with the last arguments after the wait', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 10);
    debounced(1);
    debounced(2);
    vi.advanceTimersByTime(9);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('cancel drops the pending call', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 10);
    debounced(1);
    debounced.cancel();
    vi.advanceTimersByTime(10);
    expect(fn).not.toHaveBeenCalled();
  });
});
