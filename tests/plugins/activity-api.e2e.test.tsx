import { describe, expect, it, vi } from 'vitest';
import type { PluginSetupParams } from '@/index';
import { createTestPlugin, renderSolution } from '~/tests/utils/render-solution';

describe('plugin activity api', () => {
  it('returns the current params from activity.getParams()', async () => {
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

    const { api } = await renderSolution('regular', { plugins: [plugin] });

    api.setCurrentActivity('getparams-activity', { key: 'value' });
    api.setModalState(true);

    await vi.waitFor(() => {
      const params = activityApi.getParams();
      expect(params).toMatchObject({ key: 'value' });
    });
  });

  it('notifies activity.subscribeToParams() when params change', async () => {
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

    const { api } = await renderSolution('regular', { plugins: [plugin] });

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

  it('drops params subscriptions when the plugin is unregistered', async () => {
    const paramsCallback = vi.fn<(params: Record<string, unknown>) => void>();
    const dispose = vi.fn();
    // The sentinel: a plugin that stays subscribes after the removed one, so new params reach it after they would have
    // reached the removed subscription.
    const sentinel = vi.fn<(params: Record<string, unknown>) => void>();

    const plugin = createTestPlugin({
      id: 'actapi-cleanup',
      setup: ({ pluginApi }) => {
        pluginApi.activity.subscribeToParams(paramsCallback);
        return dispose;
      },
    });
    const kept = createTestPlugin({
      id: 'actapi-cleanup-sentinel',
      setup: ({ pluginApi }) => {
        pluginApi.activity.subscribeToParams(sentinel);
      },
    });

    const { config, api } = await renderSolution('regular', { plugins: [plugin, kept] });

    await vi.waitFor(() => {
      expect(paramsCallback).toHaveBeenCalled();
    });

    config.plugins = [kept];
    await vi.waitFor(() => {
      expect(dispose).toHaveBeenCalledOnce();
    });

    paramsCallback.mockClear();
    api.setCurrentActivity('some-activity', { data: 'test' });
    await vi.waitFor(() => expect(sentinel).toHaveBeenLastCalledWith({ data: 'test' }));

    expect(paramsCallback).not.toHaveBeenCalled();
  });
});

declare module '@/types/index' {
  interface CustomActivities {
    'getparams-activity': {
      params: {
        key: string;
        value?: unknown;
      };
    };
    'subscribe-activity': {
      params: Record<string, unknown>;
    };
    'some-activity': {
      params: {
        data: string;
      };
    };
  }
}
