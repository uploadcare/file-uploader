import { describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../../controllers/ConfigController';
import { RouterController } from '../../controllers/RouterController';
import { UploadCollectionController } from '../../controllers/UploadCollectionController';
import { ControllerContainer } from '../../di/ControllerContainer';
import { logger } from '../../logger';
import { buildPluginApi } from './buildPluginApi';
import { PluginRegistry } from './PluginRegistry';

const setup = () => {
  // M-god step 9c-1: the plugin API resolves the router (and, for `files.update`,
  // the upload collection) off the per-ctx `ControllerContainer` (was the
  // shared-instances `bag`). RouterController is container-resolved (M-god step
  // 3c): its emit target (`EventEmitter`) is `@inject`-ed, so it must be built
  // through the container. Navigation in these specs emits to the
  // auto-constructed bus (no listeners) harmlessly.
  const container = new ControllerContainer();
  const router = container.get(RouterController);
  const registry = new PluginRegistry(() => {});
  // M-god step 7: the plugin API reads config directly off a `ConfigController`
  // (was the `*cfg/*` PubSub facade).
  const config = new ConfigController();
  const configSubscriptions: (() => void)[] = [];
  // One scoped logger per plugin (mirrors PluginController's controllerLogger).
  const log = logger.scope('plugin:test-plugin');
  const api = buildPluginApi(registry, config, container, 'test-plugin', configSubscriptions, log);
  return { api, router, config, registry, configSubscriptions, container, log };
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
    it('exposes the plugin logger on pluginApi.logger', () => {
      const { api, log } = setup();
      expect(api.logger).toBe(log);
    });

    it('registerConfig seeds a custom key on first sight, idempotent afterwards', () => {
      const { api, config } = setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      api.registry.registerConfig({ name: 'myPluginOption', defaultValue: 'a' });
      expect(config.getCustom('myPluginOption')).toBe('a');

      // Re-register keeps the current value (does not reset to the default) and
      // warns that the name is already taken (first-wins).
      config.setCustom('myPluginOption', 'b');
      api.registry.registerConfig({ name: 'myPluginOption', defaultValue: 'a' });
      expect(config.getCustom('myPluginOption')).toBe('b');
      expect(warn).toHaveBeenCalledOnce();
      warn.mockRestore();
    });

    it('registerConfig warns on this plugin logger and keeps the first when a name collides', () => {
      const { api, config } = setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      api.registry.registerConfig({ name: 'dupOption', defaultValue: 'first' });
      // Second registration (same plugin API / same logger) loses; first value stays.
      api.registry.registerConfig({ name: 'dupOption', defaultValue: 'second' });
      expect(config.getCustom('dupOption')).toBe('first');
      expect(warn).toHaveBeenCalledWith('[uc][plugin:test-plugin]', 'Config option "dupOption" is already registered');
      warn.mockRestore();
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

  // M-god step 9c-1: `files.update` resolves the upload collection off the
  // container (`container.getOrNull(UploadCollectionController)`) — was the
  // shared-instances `bag.uploadCollection` getter.
  describe('files api (container-resolved upload collection)', () => {
    it('update applies cdnUrl / cdnUrlModifiers / mimeType changes to the collection entry', () => {
      const { api, container } = setup();
      const collection = container.get(UploadCollectionController);
      const internalId = collection.add({ externalUrl: 'https://example.com/a.jpg' });

      api.files.update(internalId, {
        cdnUrl: 'https://ucarecdn.com/uuid/',
        cdnUrlModifiers: '-/resize/100x/',
        mimeType: 'image/png',
      });

      const entry = collection.read(internalId)!;
      expect(entry.get('cdnUrl')).toBe('https://ucarecdn.com/uuid/');
      expect(entry.get('cdnUrlModifiers')).toBe('-/resize/100x/');
      expect(entry.get('mimeType')).toBe('image/png');
    });

    it('update applies a new file, syncing fileSize', () => {
      const { api, container } = setup();
      const collection = container.get(UploadCollectionController);
      const internalId = collection.add({ externalUrl: 'https://example.com/a.jpg' });

      const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
      api.files.update(internalId, { file });

      const entry = collection.read(internalId)!;
      expect(entry.get('file')).toBe(file);
      expect(entry.get('fileSize')).toBe(file.size);
    });

    it('update is a no-op for an unknown internalId (no throw)', () => {
      const { api } = setup();
      expect(() => api.files.update('does-not-exist', { mimeType: 'image/png' })).not.toThrow();
    });
  });

  // M-god step 9c-1: `activity.getParams`/`subscribeToParams` read the
  // container-resolved `RouterController` (was `bag.router`).
  describe('activity api (container-resolved router)', () => {
    it('getParams returns the router params', () => {
      const { api, router } = setup();
      router.traverse('onFileAdd'); // upload-list, params {}
      expect(api.activity.getParams()).toEqual(router.params);
    });

    it('subscribeToParams fires immediately then on param changes, and registers its teardown', () => {
      const { api, router, configSubscriptions } = setup();
      const cb = vi.fn();
      const unsub = api.activity.subscribeToParams(cb);
      expect(cb).toHaveBeenCalledTimes(1);
      expect(configSubscriptions).toHaveLength(1);

      router.navigate('start-from');
      expect(cb.mock.calls.length).toBeGreaterThanOrEqual(2);

      cb.mockClear();
      unsub();
      router.navigate('camera');
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
