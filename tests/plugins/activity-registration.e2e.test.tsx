import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { PluginRender } from '@/index.ts';
import { addSource, createTestPlugin, getApi, renderUploader } from './utils';

describe('Activity Registration', () => {
  it('should call render() when activity becomes active via setCurrentActivity', async () => {
    const render = vi.fn(() => undefined);
    const plugin = createTestPlugin({
      id: 'act-render',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerActivity({
          id: 'test-activity',
          render,
        });
      },
    });

    await renderUploader([plugin]);
    const api = getApi();

    api.setCurrentActivity('test-activity');
    api.setModalState(true);

    await vi.waitFor(
      () => {
        expect(render).toHaveBeenCalled();
      },
      {
        timeout: 5000,
      },
    );
  });

  it('should pass activity params to render()', async () => {
    const render = vi.fn<PluginRender>(() => undefined);
    const plugin = createTestPlugin({
      id: 'act-params',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerActivity({
          id: 'params-activity',
          render,
        });
      },
    });

    await renderUploader([plugin]);
    const api = getApi();

    api.setCurrentActivity('params-activity', { foo: 'bar', num: 42 });
    api.setModalState(true);

    await vi.waitFor(() => {
      expect(render).toHaveBeenCalled();
      const calls = render.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBeInstanceOf(HTMLElement);
      expect(lastCall[1]).toMatchObject({ foo: 'bar', num: 42 });
    });
  });

  it('should call dispose (return value of render) when activity is deactivated', async () => {
    const dispose = vi.fn();
    const render = vi.fn((_el: HTMLElement) => dispose);

    const plugin = createTestPlugin({
      id: 'act-dispose',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerActivity({
          id: 'dispose-activity',
          render,
        });

        pluginApi.registry.registerSource({
          id: 'dispose-source',
          label: 'Dispose Source',
          onSelect: () => {},
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    addSource(config, 'dispose-source');

    const api = getApi();

    api.setCurrentActivity('dispose-activity');
    api.setModalState(true);

    await vi.waitFor(() => {
      expect(render).toHaveBeenCalled();
    });

    // Navigate away from the activity
    api.setCurrentActivity(null);

    await vi.waitFor(() => {
      expect(dispose).toHaveBeenCalled();
    });
  });

  it('should render content into the host element', async () => {
    const plugin = createTestPlugin({
      id: 'act-dom',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerActivity({
          id: 'dom-activity',
          render: (el) => {
            const div = document.createElement('div');
            div.textContent = 'Plugin Activity Content';
            el.appendChild(div);
            return () => el.replaceChildren();
          },
        });
      },
    });

    await renderUploader([plugin]);
    const api = getApi();

    api.setCurrentActivity('dom-activity');
    api.setModalState(true);

    await expect.element(page.getByText('Plugin Activity Content')).toBeVisible();
  });

  it('should clear container DOM on deactivate', async () => {
    const plugin = createTestPlugin({
      id: 'act-clear',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerActivity({
          id: 'clear-activity',
          render: (el) => {
            const div = document.createElement('div');
            div.textContent = 'Will Be Cleared';
            el.appendChild(div);
            return () => {};
          },
        });
      },
    });

    await renderUploader([plugin]);
    const api = getApi();

    api.setCurrentActivity('clear-activity');
    api.setModalState(true);

    await expect.element(page.getByText('Will Be Cleared')).toBeVisible();

    api.setCurrentActivity(null);

    await expect.element(page.getByText('Will Be Cleared')).not.toBeInTheDocument();
  });

  it('should remove activity host when plugin is unregistered', async () => {
    const render = vi.fn((el: HTMLElement) => {
      el.textContent = 'Activity To Remove';
      return () => {};
    });

    const plugin = createTestPlugin({
      id: 'act-remove',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerActivity({
          id: 'remove-activity',
          render,
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    const api = getApi();

    api.setCurrentActivity('remove-activity');
    api.setModalState(true);

    await expect.element(page.getByText('Activity To Remove')).toBeVisible();

    config.plugins = [];

    await expect.element(page.getByText('Activity To Remove')).not.toBeInTheDocument();
  });

  it('should purge activity registration when setup throws', async () => {
    const plugin = createTestPlugin({
      id: 'act-throw-setup',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerActivity({
          id: 'throw-activity',
          render: (el) => {
            el.textContent = 'Throw Activity';
            return () => {};
          },
        });
        throw new Error('setup failed');
      },
    });

    await renderUploader([plugin]);
    const api = getApi();

    api.setCurrentActivity('throw-activity');
    api.setModalState(true);

    // Activity should not render because setup failed and registrations were purged
    await expect.element(page.getByText('Throw Activity')).not.toBeInTheDocument();
  });
});

declare module '@/types/index' {
  interface CustomActivities {
    'test-activity': { params: never };
    'params-activity': { params: { foo: string; num: number } };
    'dispose-activity': { params: never };
    'dom-activity': { params: never };
    'clear-activity': { params: never };
    'remove-activity': { params: never };
    'throw-activity': { params: never };
  }
}
