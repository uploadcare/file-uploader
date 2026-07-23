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

    config.register({ name: 'unsplashApiKey', defaultValue: 'default-key' });

    expect(config.hasKey('unsplashApiKey')).toBe(true);
    expect(config.getCustom('unsplashApiKey')).toBe('default-key');
  });

  it('register() keeps a value that was set before registration', () => {
    const config = new ConfigController();
    config.setCustom('unsplashApiKey', 'preset');

    config.register({ name: 'unsplashApiKey', defaultValue: 'default-key' });

    expect(config.getCustom('unsplashApiKey')).toBe('preset');
  });

  it('re-register is idempotent and does not clobber the current value', () => {
    const config = new ConfigController();
    config.register({ name: 'unsplashApiKey', defaultValue: 'default-key' });
    config.setCustom('unsplashApiKey', 'changed');

    config.register({ name: 'unsplashApiKey', defaultValue: 'default-key' });

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
    config.register({ name: '__proto__', defaultValue: { polluted: true } });

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
  });

  it('register preserves a custom key that was explicitly cleared to undefined', () => {
    const config = new ConfigController();
    // Set then clear so an own property with value `undefined` exists — the
    // case where own-property vs `=== undefined` detection diverges.
    config.setCustom('unsplashApiKey', 'preset');
    config.setCustom('unsplashApiKey', undefined);

    config.register({ name: 'unsplashApiKey', defaultValue: 'default-key' });

    expect(config.getCustom('unsplashApiKey')).toBeUndefined();
  });

  it('destroy() clears custom keys and listeners', () => {
    const config = new ConfigController();
    config.register({ name: 'unsplashApiKey', defaultValue: 'x' });
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

  it('customDefinition returns the resolved descriptor for a registered key (or undefined)', () => {
    const config = new ConfigController();
    const normalize = (v: unknown) => String(v);
    config.register({ name: 'unsplashApiKey', defaultValue: 'x', normalize });

    // customDefinition now returns the RESOLVED descriptor (serialization
    // defaults filled), carrying the registered name/defaultValue/normalize.
    expect(config.customDefinition('unsplashApiKey')).toMatchObject({
      name: 'unsplashApiKey',
      defaultValue: 'x',
      attribute: true,
      normalize,
    });
    expect(config.customDefinition('not-registered')).toBeUndefined();
  });

  describe('descriptors + schema', () => {
    it('descriptor() returns built-in descriptors, registered descriptors, and undefined for unknown', () => {
      const config = new ConfigController();
      expect(config.descriptor('multiple')?.attribute).toBe(true);
      expect(config.descriptor('metadata')?.attribute).toBe(false); // complex built-in
      expect(config.descriptor('nope')).toBeUndefined();

      config.register({ name: 'customKey', defaultValue: 'd' });
      expect(config.descriptor('customKey')?.defaultValue).toBe('d');
    });

    it('getCustomDescriptors() returns only the dynamically-registered descriptors', () => {
      const config = new ConfigController();
      expect(config.getCustomDescriptors()).toEqual([]);
      config.register({ name: 'a', defaultValue: 1 });
      config.register({ name: 'b', defaultValue: 2 });
      expect(
        config
          .getCustomDescriptors()
          .map((d) => d.name)
          .sort(),
      ).toEqual(['a', 'b']);
    });

    it('onSchemaChange fires on register and stops after unsubscribe', () => {
      const config = new ConfigController();
      const listener = vi.fn();
      const off = config.onSchemaChange(listener);
      config.register({ name: 'a', defaultValue: 1 });
      expect(listener).toHaveBeenCalledTimes(1);
      // Idempotent re-register does not fire (no schema change).
      config.register({ name: 'a', defaultValue: 1 });
      expect(listener).toHaveBeenCalledTimes(1);
      off();
      config.register({ name: 'b', defaultValue: 2 });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unregisterByOwner drops that owner’s keys and fires schema change; leaves others', () => {
      const config = new ConfigController();
      config.register({ name: 'a', defaultValue: 1 }, 'plugin-1');
      config.register({ name: 'b', defaultValue: 2 }, 'plugin-2');
      const listener = vi.fn();
      config.onSchemaChange(listener);

      config.unregisterByOwner('plugin-1');
      expect(config.descriptor('a')).toBeUndefined();
      expect(config.descriptor('b')?.defaultValue).toBe(2);
      expect(listener).toHaveBeenCalledTimes(1);

      // No-op when the owner has no keys — no schema-change fire.
      config.unregisterByOwner('plugin-1');
      expect(listener).toHaveBeenCalledTimes(1);
    });
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

  describe('config-writer registry', () => {
    it('tracks registered writers by identity and deregisters them', () => {
      const c = new ConfigController();
      const a = { isConnected: true };
      const b = { isConnected: true };
      c.registerWriter(a);
      c.registerWriter(b);
      expect(c.getWriters()).toHaveLength(2);
      expect(c.getWriters()).toContain(a);
      c.unregisterWriter(a);
      expect(c.getWriters()).toEqual([b]);
    });

    it('registering the same host twice is idempotent (Set semantics)', () => {
      const c = new ConfigController();
      const a = { isConnected: true };
      c.registerWriter(a);
      c.registerWriter(a);
      expect(c.getWriters()).toHaveLength(1);
    });

    it('destroy() clears the writer registry', () => {
      const c = new ConfigController();
      c.registerWriter({ isConnected: true });
      c.destroy();
      expect(c.getWriters()).toEqual([]);
    });
  });
});
