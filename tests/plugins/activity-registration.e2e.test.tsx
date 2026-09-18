import { describe, expect, it, vi } from 'vitest';
import type { PluginRender } from '@/index.ts';
import { delay } from '@/utils/delay';
import { addSource, createTestPlugin, renderSolution, within } from '~/tests/utils/render-solution';

describe('plugin activities', () => {
  it('calls render() when the activity is activated via setCurrentActivity', async () => {
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

    const { api } = await renderSolution('regular', { plugins: [plugin] });

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

  it('passes activity params to render()', async () => {
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

    const { api } = await renderSolution('regular', { plugins: [plugin] });

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

  it('calls the disposer returned by render() on deactivation', async () => {
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

    const { config, api } = await renderSolution('regular', { plugins: [plugin] });
    addSource(config, 'dispose-source');

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

  it('renders content into the host element', async () => {
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

    const { api, root } = await renderSolution('regular', { plugins: [plugin] });

    api.setCurrentActivity('dom-activity');
    api.setModalState(true);

    await expect.element(within(root).getByText('Plugin Activity Content')).toBeVisible();
  });

  it('clears the host DOM on deactivation', async () => {
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

    const { api, root } = await renderSolution('regular', { plugins: [plugin] });

    api.setCurrentActivity('clear-activity');
    api.setModalState(true);

    await expect.element(within(root).getByText('Will Be Cleared')).toBeVisible();

    api.setCurrentActivity(null);

    await expect.element(within(root).getByText('Will Be Cleared')).not.toBeInTheDocument();
  });

  it('removes the activity host when the plugin is unregistered', async () => {
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

    const { config, api, root } = await renderSolution('regular', { plugins: [plugin] });

    api.setCurrentActivity('remove-activity');
    api.setModalState(true);

    await expect.element(within(root).getByText('Activity To Remove')).toBeVisible();

    config.plugins = [];

    await expect.element(within(root).getByText('Activity To Remove')).not.toBeInTheDocument();
  });

  it('purges the activity when setup() throws', async () => {
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

    const { api, root } = await renderSolution('regular', { plugins: [plugin] });

    api.setCurrentActivity('throw-activity');
    api.setModalState(true);

    // Activity should not render because setup failed and registrations were purged
    await expect.element(within(root).getByText('Throw Activity')).not.toBeInTheDocument();
  });

  it('renders an activity registered by an async setup() without awaiting pluginsReady', async () => {
    const plugin = createTestPlugin({
      id: 'act-async-setup',
      setup: async ({ pluginApi }) => {
        // Deliberate: a slow async setup() so setCurrentActivity runs before the activity is registered.
        await delay(50);
        pluginApi.registry.registerActivity({
          id: 'async-setup-activity',
          render: (el) => {
            const div = document.createElement('div');
            div.textContent = 'Async Setup Activity Content';
            el.appendChild(div);
            return () => el.replaceChildren();
          },
        });
      },
    });

    const { api, root } = await renderSolution('regular', { plugins: [plugin] });

    // setCurrentActivity internally waits for pluginsReady, so no explicit await needed
    api.setCurrentActivity('async-setup-activity');
    api.setModalState(true);

    await expect.element(within(root).getByText('Async Setup Activity Content')).toBeVisible();
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
    'async-setup-activity': { params: never };
  }
}
