import { describe, expect, it, vi } from 'vitest';
import { PubSub } from '../lit/PubSubCompat';
import type { SharedState } from '../lit/SharedState';
import { createSharedInstancesBag } from '../lit/shared-instances';
import { sharedConfigKey } from './sharedConfigKey';
import { UploaderPublicApi } from './UploaderPublicApi';

describe('UploaderPublicApi', () => {
  it.each([
    ['initFlow', (api: UploaderPublicApi) => api.initFlow()],
    ['setCurrentActivity', (api: UploaderPublicApi) => api.setCurrentActivity('upload-list')],
    ['setModalState', (api: UploaderPublicApi) => api.setModalState(true)],
  ])('%s does not read shared instances when destroyed while plugins are loading', async (_name, call) => {
    let pluginsLoaded!: () => void;
    const pluginsReady = new Promise<void>((resolve) => (pluginsLoaded = resolve));
    const ctxName = 'public-api-teardown';
    const ctx = PubSub.registerCtx<Record<string, unknown>>(
      {
        '*pluginManager': { pluginsReady: () => pluginsReady },
        '*blocksRegistry': new Set(),
        '*uploadCollection': { size: 0 },
        '*currentActivity': 'upload-list',
        [sharedConfigKey('sourceList')]: 'local',
      },
      ctxName,
    ) as unknown as PubSub<SharedState>;
    const api = new UploaderPublicApi(createSharedInstancesBag(() => ctx));
    call(api);

    // What LitBlock.destroyCtxCallback does: destroy the instances, null their keys, delete the ctx.
    api.destroy();
    ctx.pub('*pluginManager', null as never);
    ctx.pub('*blocksRegistry', null as never);
    PubSub.deleteCtx(ctxName);

    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    pluginsLoaded();
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off('unhandledRejection', unhandled);

    expect(unhandled).not.toHaveBeenCalled();
  });
});
