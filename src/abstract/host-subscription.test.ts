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

  it('isolates a throwing listener so the others still run', () => {
    const listeners = new Listeners();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    listeners.subscribe(bad);
    listeners.subscribe(good);

    expect(() => listeners.notify()).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
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
