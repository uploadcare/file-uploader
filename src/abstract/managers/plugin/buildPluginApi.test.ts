import { describe, expect, it, vi } from 'vitest';
import type { SharedInstancesBag } from '../../../lit/shared-instances';
import { ConfigController } from '../../controllers/ConfigController';
import { RouterController } from '../../controllers/RouterController';
import { ControllerContainer } from '../../di/ControllerContainer';
import { buildPluginApi } from './buildPluginApi';
import { PluginRegistry } from './PluginRegistry';

const setup = () => {
  // RouterController is container-resolved now (M-god step 3c): its emit target
  // (`EventEmitter`) is `@inject`-ed, so build it through a container. Navigation
  // in these specs emits to the auto-constructed bus (no listeners) harmlessly.
  const router = new ControllerContainer().get(RouterController);
  const bag = { router } as unknown as SharedInstancesBag;
  const registry = new PluginRegistry(() => {});
  // M-god step 7: the plugin API reads config directly off a `ConfigController`
  // (was the `*cfg/*` PubSub facade).
  const config = new ConfigController();
  const configSubscriptions: (() => void)[] = [];
  const api = buildPluginApi(registry, config, bag, 'test-plugin', configSubscriptions);
  return { api, router, config, registry, configSubscriptions };
};

describe('buildPluginApi', () => {
  describe('router api', () => {
    it('traverse(onFileAdd) runs the standard post-add routing (default: upload-list)', () => {
      const { api, router } = setup();
      api.router.traverse('onFileAdd');
      expect(router.currentActivity).toBe('upload-list');
    });

    it('traverse is interceptable by the registered hooks, like any built-in source', () => {
      const { api, router } = setup();
      router.hooks.onFileAdd(() => null); // e.g. DynamicBtn keeping the modal closed
      api.router.traverse('onFileAdd');
      expect(router.currentActivity).toBeNull();
    });

    it('traverse(onBack) resolves through the router history', () => {
      const { api, router } = setup();
      router.navigate('start-from');
      router.navigate('camera');
      api.router.traverse('onBack');
      expect(router.currentActivity).toBe('start-from');
    });
  });

  describe('config api (direct ConfigController, off the *cfg/* facade)', () => {
    it('registerConfig seeds a custom key on first sight, idempotent afterwards', () => {
      const { api, config } = setup();
      api.registry.registerConfig({ name: 'myPluginOption', defaultValue: 'a' });
      expect(config.getCustom('myPluginOption')).toBe('a');

      // Re-register keeps the current value (does not reset to the default).
      config.setCustom('myPluginOption', 'b');
      api.registry.registerConfig({ name: 'myPluginOption', defaultValue: 'a' });
      expect(config.getCustom('myPluginOption')).toBe('b');
    });

    it('registerConfig preserves a value written before the plugin registered', () => {
      const { api, config } = setup();
      config.setCustom('preSeeded', 'early');
      api.registry.registerConfig({ name: 'preSeeded', defaultValue: 'default' });
      expect(config.getCustom('preSeeded')).toBe('early');
    });

    it('get reads the live value from the ConfigController', () => {
      const { api, config } = setup();
      config.set('sourceList', 'local');
      expect(api.config.get('sourceList')).toBe('local');
      config.set('sourceList', 'local, camera');
      expect(api.config.get('sourceList')).toBe('local, camera');
    });

    it('subscribe fires immediately, then only on an actual change (Object.is dedup)', () => {
      const { api, config } = setup();
      config.set('sourceList', 'v0');
      const cb = vi.fn();
      api.config.subscribe('sourceList', cb);
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenLastCalledWith('v0');

      config.set('sourceList', 'v1');
      expect(cb).toHaveBeenCalledTimes(2);
      expect(cb).toHaveBeenLastCalledWith('v1');

      // Same value: deduped, no extra call.
      config.set('sourceList', 'v1');
      expect(cb).toHaveBeenCalledTimes(2);

      // A change to an unrelated key must not fire this key's subscriber.
      config.set('multiple', !config.get('multiple'));
      expect(cb).toHaveBeenCalledTimes(2);
    });

    it('subscribe registers its teardown in the configSubscriptions sink and unsub stops callbacks', () => {
      const { api, config, configSubscriptions } = setup();
      config.set('sourceList', 'a');
      const cb = vi.fn();
      const unsub = api.config.subscribe('sourceList', cb);
      expect(configSubscriptions).toHaveLength(1);
      cb.mockClear();

      unsub();
      config.set('sourceList', 'b');
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
