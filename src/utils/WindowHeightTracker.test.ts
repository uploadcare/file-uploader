import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WindowHeightTracker } from './WindowHeightTracker';

const PROP = '--uploadcare-blocks-window-height';
const read = () => document.documentElement.style.getPropertyValue(PROP);

describe('WindowHeightTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.documentElement.style.removeProperty(PROP);
  });

  it('sets the window-height CSS var on the first registered client (debounced flush)', () => {
    const client = document.createElement('div');
    expect(read()).toBe('');

    WindowHeightTracker.registerClient(client);
    vi.advanceTimersByTime(100);

    expect(read()).toBe(`${window.innerHeight}px`);
    WindowHeightTracker.unregisterClient(client);
  });

  it('removes the var only once the last client unregisters (refcounted)', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    WindowHeightTracker.registerClient(a);
    WindowHeightTracker.registerClient(b);
    vi.advanceTimersByTime(100);
    expect(read()).toBe(`${window.innerHeight}px`);

    WindowHeightTracker.unregisterClient(a);
    // One client remains — the var stays.
    expect(read()).toBe(`${window.innerHeight}px`);

    WindowHeightTracker.unregisterClient(b);
    // Last client gone — the var is cleared.
    expect(read()).toBe('');
  });

  it('a register→unregister within the debounce window leaves the var unset (pending flush cancelled)', () => {
    const client = document.createElement('div');
    WindowHeightTracker.registerClient(client);
    // Unregister before the 100ms debounced flush fires.
    WindowHeightTracker.unregisterClient(client);
    vi.advanceTimersByTime(200);

    // detachTracker cancelled the pending flush — no stale value re-set.
    expect(read()).toBe('');
  });
});
