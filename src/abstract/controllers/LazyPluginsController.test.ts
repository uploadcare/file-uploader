import { describe, expect, it, vi } from 'vitest';
import type { LazyPluginEntry } from '../managers/plugin/LazyPluginLoader';
import { LazyPluginsController } from './LazyPluginsController';

const entry = (): LazyPluginEntry => ({
  configDeps: [],
  isEnabled: () => true,
  load: () => undefined,
});

describe('LazyPluginsController', () => {
  it('seeds to null', () => {
    expect(new LazyPluginsController().get()).toBeNull();
  });

  it('round-trips entries through get/set', () => {
    const c = new LazyPluginsController();
    const entries = [entry()];
    c.set(entries);
    expect(c.get()).toBe(entries);

    c.set(null);
    expect(c.get()).toBeNull();
  });

  it('subscribe fires on a real change and dedups an equal write (Object.is)', () => {
    const c = new LazyPluginsController();
    const cb = vi.fn();
    c.subscribe(cb);

    const entries = [entry()];
    c.set(entries);
    expect(cb).toHaveBeenCalledTimes(1);

    c.set(entries); // same reference — Object.is dedup
    expect(cb).toHaveBeenCalledTimes(1);

    c.set([entry()]); // new reference
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('subscribe returns an unsubscribe', () => {
    const c = new LazyPluginsController();
    const cb = vi.fn();
    const unsub = c.subscribe(cb);
    c.set([entry()]);
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
    c.set([entry()]);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('destroy() clears the store and listeners', () => {
    const c = new LazyPluginsController();
    const cb = vi.fn();
    c.subscribe(cb);
    c.destroy();
    c.set([entry()]);
    expect(cb).not.toHaveBeenCalled();
  });
});
