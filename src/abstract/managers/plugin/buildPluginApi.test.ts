import { describe, expect, it, vi } from 'vitest';
import type { PubSub } from '../../../lit/PubSubCompat';
import type { SharedState } from '../../../lit/SharedState';
import type { SharedInstancesBag } from '../../../lit/shared-instances';
import { RouterController } from '../../controllers/RouterController';
import { buildPluginApi } from './buildPluginApi';
import { PluginRegistry } from './PluginRegistry';

const setup = () => {
  const router = new RouterController({ emit: vi.fn() });
  const bag = { router } as unknown as SharedInstancesBag;
  const registry = new PluginRegistry(() => {});
  const ctx = {
    has: () => true,
    add: () => {},
    read: () => undefined,
    sub: () => () => {},
  } as unknown as PubSub<SharedState>;
  const api = buildPluginApi(registry, ctx, bag, 'test-plugin', []);
  return { api, router };
};

describe('buildPluginApi', () => {
  describe('router api', () => {
    it('afterFileAdd runs the standard post-add routing (default: upload-list)', () => {
      const { api, router } = setup();
      api.router.afterFileAdd();
      expect(router.currentActivity).toBe('upload-list');
    });

    it('afterFileAdd is interceptable by the registered hooks, like any built-in source', () => {
      const { api, router } = setup();
      router.hooks.afterFileAdd(() => null); // e.g. DynamicBtn keeping the modal closed
      api.router.afterFileAdd();
      expect(router.currentActivity).toBeNull();
    });
  });
});
