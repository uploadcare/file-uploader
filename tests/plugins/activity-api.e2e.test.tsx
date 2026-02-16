import { describe, expect, it, vi } from 'vitest';
import type { PluginSetupParams } from '@/index.ts';
import { createTestPlugin, getApi, renderUploader } from './utils';

describe('Activity API', () => {
  it('should return current params via activity.getParams()', async () => {
    let activityApi: PluginSetupParams['pluginApi']['activity'];

    const plugin = createTestPlugin({
      id: 'actapi-getparams',
      setup: ({ pluginApi }) => {
        activityApi = pluginApi.activity;
        pluginApi.registry.registerActivity({
          id: 'getparams-activity',
          render: () => undefined,
        });
      },
    });

    await renderUploader([plugin]);
    const api = getApi();

    api.setCurrentActivity('getparams-activity', { key: 'value' });
    api.setModalState(true);

    await vi.waitFor(() => {
      const params = activityApi.getParams();
      expect(params).toMatchObject({ key: 'value' });
    });
  });

  it('should notify subscribers via activity.subscribeToParams() when params change', async () => {
    const paramsCallback = vi.fn<(params: Record<string, unknown>) => void>();

    const plugin = createTestPlugin({
      id: 'actapi-subscribe',
      setup: ({ pluginApi }) => {
        pluginApi.activity.subscribeToParams(paramsCallback);
        pluginApi.registry.registerActivity({
          id: 'subscribe-activity',
          render: () => undefined,
        });
      },
    });

    await renderUploader([plugin]);
    const api = getApi();

    api.setCurrentActivity('subscribe-activity', { step: 1 });
    api.setModalState(true);

    await vi.waitFor(() => {
      expect(paramsCallback).toHaveBeenCalledWith(expect.objectContaining({ step: 1 }));
    });

    paramsCallback.mockClear();

    api.setCurrentActivity('subscribe-activity', { step: 2 });

    await vi.waitFor(() => {
      expect(paramsCallback).toHaveBeenCalledWith(expect.objectContaining({ step: 2 }));
    });
  });

  it('should auto-cleanup activity params subscriptions on plugin unregister', async () => {
    const paramsCallback = vi.fn<(params: Record<string, unknown>) => void>();

    const plugin = createTestPlugin({
      id: 'actapi-cleanup',
      setup: ({ pluginApi }) => {
        pluginApi.activity.subscribeToParams(paramsCallback);
      },
    });

    const { config } = await renderUploader([plugin]);

    await vi.waitFor(() => {
      expect(paramsCallback).toHaveBeenCalled();
    });

    paramsCallback.mockClear();
    config.plugins = [];

    // Wait for cleanup to happen
    await new Promise((resolve) => setTimeout(resolve, 100));
    paramsCallback.mockClear();

    // Changes should not trigger the old subscription
    const api = getApi();
    api.setCurrentActivity('some-activity', { data: 'test' });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(paramsCallback).not.toHaveBeenCalled();
  });
});
