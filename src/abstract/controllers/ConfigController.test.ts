import { Signal } from '@lit-labs/signals';
import { describe, expect, it, vi } from 'vitest';
import { initialConfig } from '../../blocks/Config/initialConfig';
import { ConfigController } from './ConfigController';

describe('ConfigController', () => {
  it('seeds built-in defaults from initialConfig', () => {
    const config = new ConfigController();
    expect(config.get('multiple')).toBe(initialConfig.multiple);
    expect(config.get('maxConcurrentRequests')).toBe(initialConfig.maxConcurrentRequests);
    expect(config.hasKey('multiple')).toBe(true);
  });

  it('set() stores the value and notifies, deduping unchanged writes', () => {
    const config = new ConfigController();
    const listener = vi.fn();
    config.subscribe(listener);

    config.set('multiple', false);
    expect(config.get('multiple')).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);

    config.set('multiple', false); // unchanged — no notify
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const config = new ConfigController();
    const listener = vi.fn();
    const off = config.subscribe(listener);
    off();

    config.set('multiple', false);
    expect(listener).not.toHaveBeenCalled();
  });

  it('register() seeds a custom key with its default and reports it as known', () => {
    const config = new ConfigController();
    expect(config.hasKey('unsplashApiKey')).toBe(false);

    config.register('unsplashApiKey', 'default-key');

    expect(config.hasKey('unsplashApiKey')).toBe(true);
    expect(config.getCustom('unsplashApiKey')).toBe('default-key');
  });

  it('register() keeps a value that was set before registration', () => {
    const config = new ConfigController();
    config.setCustom('unsplashApiKey', 'preset');

    config.register('unsplashApiKey', 'default-key');

    expect(config.getCustom('unsplashApiKey')).toBe('preset');
  });

  it('re-register is idempotent and does not clobber the current value', () => {
    const config = new ConfigController();
    config.register('unsplashApiKey', 'default-key');
    config.setCustom('unsplashApiKey', 'changed');

    config.register('unsplashApiKey', 'default-key');

    expect(config.getCustom('unsplashApiKey')).toBe('changed');
  });

  it('hasKey uses own-property semantics, not the prototype chain', () => {
    const config = new ConfigController();
    expect(config.hasKey('toString')).toBe(false);
    expect(config.hasKey('constructor')).toBe(false);
    expect(config.hasKey('__proto__')).toBe(false);
  });

  it('does not pollute the prototype when a custom key is named __proto__', () => {
    const config = new ConfigController();
    config.setCustom('__proto__', { polluted: true });
    config.register('__proto__', { polluted: true });

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
  });

  it('register preserves a custom key that was explicitly cleared to undefined', () => {
    const config = new ConfigController();
    // Set then clear so an own property with value `undefined` exists — the
    // case where own-property vs `=== undefined` detection diverges.
    config.setCustom('unsplashApiKey', 'preset');
    config.setCustom('unsplashApiKey', undefined);

    config.register('unsplashApiKey', 'default-key');

    expect(config.getCustom('unsplashApiKey')).toBeUndefined();
  });

  it('destroy() clears custom keys and listeners', () => {
    const config = new ConfigController();
    config.register('unsplashApiKey', 'x');
    // Subscribe after registering so the listener only sees post-destroy activity.
    const listener = vi.fn();
    config.subscribe(listener);

    config.destroy();

    expect(config.hasKey('unsplashApiKey')).toBe(false);
    config.setCustom('unsplashApiKey', 'y');
    expect(listener).not.toHaveBeenCalled();
  });

  it('values exposes the live config object reflecting writes', () => {
    const config = new ConfigController();
    expect(config.values.multiple).toBe(initialConfig.multiple);

    config.set('multiple', false);
    expect(config.values.multiple).toBe(false);
  });

  it('customDefinition returns the registered definition (or undefined)', () => {
    const config = new ConfigController();
    const def = { name: 'unsplashApiKey', defaultValue: 'x', normalize: (v: unknown) => String(v) };
    config.register(def);

    expect(config.customDefinition('unsplashApiKey')).toBe(def);
    expect(config.customDefinition('not-registered')).toBeUndefined();
  });

  it('notify() fires subscribers without a state change', () => {
    const config = new ConfigController();
    const listener = vi.fn();
    config.subscribe(listener);

    config.notify();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('getTracked returns the current value, matching get() (M-god step 6a)', () => {
    const config = new ConfigController();
    expect(config.getTracked('removeCopyright')).toBe(config.get('removeCopyright'));

    config.set('removeCopyright', true);
    expect(config.getTracked('removeCopyright')).toBe(true);
    expect(config.getTracked('removeCopyright')).toBe(config.get('removeCopyright'));
  });

  it('getTracked auto-tracks the key under a Signal watcher; set() notifies it', () => {
    const config = new ConfigController();
    let notified = 0;
    const watcher = new Signal.subtle.Watcher(() => {
      notified++;
    });
    // A computed that reads via getTracked establishes the dependency on the
    // 'removeCopyright' key's signal — the exact path SignalWatcher uses in a
    // migrated render().
    const c = new Signal.Computed(() => config.getTracked('removeCopyright'));
    watcher.watch(c);
    expect(c.get()).toBe(false);

    config.set('removeCopyright', true); // tracked write → watcher notified
    expect(notified).toBe(1);
    expect(c.get()).toBe(true);

    watcher.unwatch(c);
  });

  it('setCustom does not notify when the value is unchanged', () => {
    const config = new ConfigController();
    config.setCustom('unsplashApiKey', 'v');

    const listener = vi.fn();
    config.subscribe(listener);

    config.setCustom('unsplashApiKey', 'v'); // unchanged → no notify
    expect(listener).not.toHaveBeenCalled();

    config.setCustom('unsplashApiKey', 'w'); // changed → notify
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('setMany applies several keys with one coalesced notify', () => {
    const c = new ConfigController();
    const listener = vi.fn();
    c.subscribe(listener);
    c.setMany({ multiple: true, imgOnly: true });
    expect(c.get('multiple')).toBe(true);
    expect(c.get('imgOnly')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
