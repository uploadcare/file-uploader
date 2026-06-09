import { describe, expect, it, vi } from 'vitest';
import { Listeners } from './host-subscription';

describe('Listeners', () => {
  it('notifies every subscribed listener', () => {
    const listeners = new Listeners();
    const a = vi.fn();
    const b = vi.fn();
    listeners.subscribe(a);
    listeners.subscribe(b);

    listeners.notify();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after the returned unsubscribe is called', () => {
    const listeners = new Listeners();
    const a = vi.fn();
    const unsubscribe = listeners.subscribe(a);

    unsubscribe();
    listeners.notify();

    expect(a).not.toHaveBeenCalled();
  });

  it('clear() removes all listeners', () => {
    const listeners = new Listeners();
    const a = vi.fn();
    listeners.subscribe(a);

    listeners.clear();
    listeners.notify();

    expect(a).not.toHaveBeenCalled();
  });
});
