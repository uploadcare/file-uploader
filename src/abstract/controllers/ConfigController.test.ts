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
});
