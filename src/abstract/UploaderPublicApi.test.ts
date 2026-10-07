import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { PubSub } from '../lit/PubSubCompat';
import type { SharedState } from '../lit/SharedState';
import { createSharedInstancesBag } from '../lit/shared-instances';
import { sharedConfigKey } from './sharedConfigKey';
import { UploaderPublicApi } from './UploaderPublicApi';

describe('UploaderPublicApi', () => {
  it.each([
    ['initFlow', (api: UploaderPublicApi) => api.initFlow(), 'snapshot'],
    ['setCurrentActivity', (api: UploaderPublicApi) => api.setCurrentActivity('upload-list'), 'pub'],
    ['setModalState', (api: UploaderPublicApi) => api.setModalState(false), 'pub'],
  ] as const)('%s does nothing once destroyed while plugins are loading', async (_name, call, touched) => {
    let pluginsLoaded!: () => void;
    const pluginsReady = new Promise<void>((resolve) => (pluginsLoaded = resolve));
    const snapshot = vi.fn(() => ({ sources: [] }));
    const ctxName = 'public-api-teardown';
    const ctx = PubSub.registerCtx<Record<string, unknown>>(
      {
        '*pluginManager': { pluginsReady: () => pluginsReady, snapshot },
        '*blocksRegistry': new Set(),
        '*uploadCollection': { size: 0 },
        '*currentActivity': 'upload-list',
        [sharedConfigKey('sourceList')]: 'local',
      },
      ctxName,
    ) as unknown as PubSub<SharedState>;
    onTestFinished(() => PubSub.deleteCtx(ctxName));
    const api = new UploaderPublicApi(createSharedInstancesBag(() => ctx));
    const pub = vi.spyOn(ctx, 'pub');
    call(api);

    api.destroy();
    pluginsLoaded();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect({ snapshot, pub }[touched]).not.toHaveBeenCalled();
  });
});
