import { describe, expect, it, onTestFinished } from 'vitest';
import { PubSub } from '../lit/PubSubCompat';
import type { SharedState } from '../lit/SharedState';
import { createSharedInstancesBag } from '../lit/shared-instances';
import { sharedConfigKey } from './sharedConfigKey';
import { UploaderPublicApi } from './UploaderPublicApi';

describe('UploaderPublicApi', () => {
  it.each([
    // With `local` the only source and none registered, initFlow opens the current activity's modal.
    ['initFlow', (api: UploaderPublicApi) => api.initFlow()],
    ['setCurrentActivity', (api: UploaderPublicApi) => api.setCurrentActivity('start-from')],
    ['setModalState(false)', (api: UploaderPublicApi) => api.setModalState(false)],
  ] as const)('%s does nothing once destroyed while plugins are loading', async (_name, call) => {
    let pluginsLoaded!: () => void;
    const pluginsReady = new Promise<void>((resolve) => (pluginsLoaded = resolve));
    /** The modals something has opened and not closed again. */
    const openModals = new Set<string>();
    const ctxName = 'public-api-teardown';
    const ctx = PubSub.registerCtx<Record<string, unknown>>(
      {
        '*pluginManager': { pluginsReady: () => pluginsReady, snapshot: () => ({ sources: [] }) },
        '*modalManager': {
          open: (id: string) => openModals.add(id),
          close: (id: string) => openModals.delete(id),
          closeAll: () => openModals.clear(),
        },
        '*blocksRegistry': new Set(),
        '*uploadCollection': { size: 0 },
        '*currentActivity': 'upload-list',
        '*currentActivityParams': {},
        [sharedConfigKey('sourceList')]: 'local',
      },
      ctxName,
    ) as unknown as PubSub<SharedState>;
    onTestFinished(() => PubSub.deleteCtx(ctxName));
    const api = new UploaderPublicApi(createSharedInstancesBag(() => ctx));
    call(api);

    api.destroy();
    pluginsLoaded();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ctx.read('*currentActivity')).toBe('upload-list');
    expect(ctx.read('*currentActivityParams')).toEqual({});
    expect([...openModals]).toEqual([]);
  });
});
