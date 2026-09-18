import { describe, expect, it, vi } from 'vitest';
import type { PluginSetupParams } from '@/index.ts';
import { addSource, createTestPlugin, openModal, renderSolution, within } from '~/tests/utils/render-solution';
import { cleanup } from '~/tests/utils/test-renderer';

describe('plugin lifecycle: register and unregister', () => {
  it('registers a plugin listed in config.plugins', async () => {
    const setup = vi.fn<(params: PluginSetupParams) => void>();
    const plugin = createTestPlugin({ id: 'test-register', setup });

    await renderSolution('regular', { plugins: [plugin] });

    await vi.waitFor(() => {
      expect(setup).toHaveBeenCalledOnce();
    });
  });

  it('calls setup() with pluginApi and uploaderApi', async () => {
    const setup = vi.fn<(params: PluginSetupParams) => void>();
    const plugin = createTestPlugin({ id: 'test-setup-args', setup });

    await renderSolution('regular', { plugins: [plugin] });

    await vi.waitFor(() => {
      expect(setup).toHaveBeenCalledOnce();
    });

    const args = setup.mock.calls[0][0];
    expect(args).toHaveProperty('pluginApi');
    expect(args).toHaveProperty('uploaderApi');
    expect(args.pluginApi).toHaveProperty('registry');
    expect(args.pluginApi).toHaveProperty('config');
    expect(args.pluginApi).toHaveProperty('activity');
    expect(args.pluginApi.registry).toHaveProperty('registerSource');
    expect(args.pluginApi.registry).toHaveProperty('registerActivity');
    expect(args.pluginApi.registry).toHaveProperty('registerFileAction');
    expect(args.pluginApi.registry).toHaveProperty('registerIcon');
    expect(args.pluginApi.registry).toHaveProperty('registerL10n');
    expect(args.pluginApi.registry).toHaveProperty('registerConfig');
  });

  it('unregisters a plugin removed from config.plugins', async () => {
    const setup = vi.fn();
    const plugin = createTestPlugin({
      id: 'test-unregister-source',
      setup: ({ pluginApi }) => {
        setup();
        pluginApi.registry.registerSource({
          id: 'temp-source',
          label: 'Temp Source',
          onSelect: () => {},
        });
      },
    });

    const { config, root } = await renderSolution('regular', { plugins: [plugin] });

    await vi.waitFor(() => {
      expect(setup).toHaveBeenCalledOnce();
    });

    addSource(config, 'temp-source');
    await openModal(root);
    await expect.element(within(root).getByText('Temp Source')).toBeVisible();

    config.plugins = [];

    await expect.element(within(root).getByText('Temp Source')).not.toBeInTheDocument();
  });

  it('calls the disposer on unregister', async () => {
    const dispose = vi.fn();
    const setup = vi.fn(() => dispose);
    const plugin = createTestPlugin({ id: 'test-dispose', setup });

    const { config } = await renderSolution('regular', { plugins: [plugin] });

    await vi.waitFor(() => {
      expect(setup).toHaveBeenCalledOnce();
    });

    config.plugins = [];

    await vi.waitFor(() => {
      expect(dispose).toHaveBeenCalledOnce();
    });
  });

  it('registers multiple plugins', async () => {
    const setup1 = vi.fn();
    const setup2 = vi.fn();

    const plugin1 = createTestPlugin({ id: 'multi-1', setup: setup1 });
    const plugin2 = createTestPlugin({ id: 'multi-2', setup: setup2 });

    await renderSolution('regular', { plugins: [plugin1, plugin2] });

    await vi.waitFor(() => {
      expect(setup1).toHaveBeenCalledOnce();
      expect(setup2).toHaveBeenCalledOnce();
    });
  });

  it('replaces plugins: disposes the old one and sets up the new one', async () => {
    const dispose1 = vi.fn();
    const setup1 = vi.fn(() => dispose1);
    const setup2 = vi.fn();

    const plugin1 = createTestPlugin({ id: 'replace-old', setup: setup1 });
    const plugin2 = createTestPlugin({ id: 'replace-new', setup: setup2 });

    const { config } = await renderSolution('regular', { plugins: [plugin1] });

    await vi.waitFor(() => {
      expect(setup1).toHaveBeenCalledOnce();
    });

    config.plugins = [plugin2];

    await vi.waitFor(() => {
      expect(dispose1).toHaveBeenCalledOnce();
      expect(setup2).toHaveBeenCalledOnce();
    });
  });

  it('awaits an async setup() before applying its registrations', async () => {
    const plugin = createTestPlugin({
      id: 'async-setup',
      setup: async ({ pluginApi }) => {
        await Promise.resolve();
        pluginApi.registry.registerSource({
          id: 'async-source',
          label: 'Async Source',
          onSelect: () => {},
        });
      },
    });

    const { config, root } = await renderSolution('regular', { plugins: [plugin] });
    addSource(config, 'async-source');

    await openModal(root);
    await expect.element(within(root).getByText('Async Source')).toBeVisible();
  });

  it('calls the disposer returned by an async setup() on unregister', async () => {
    const dispose = vi.fn();
    const setup = vi.fn(async () => {
      await Promise.resolve();
      return dispose;
    });
    const plugin = createTestPlugin({ id: 'async-dispose', setup });

    const { config } = await renderSolution('regular', { plugins: [plugin] });

    await vi.waitFor(() => {
      expect(setup).toHaveBeenCalledOnce();
    });

    config.plugins = [];

    await vi.waitFor(() => {
      expect(dispose).toHaveBeenCalledOnce();
    });
  });

  it('ends up registered after rapid add/remove toggling', async () => {
    const setup = vi.fn();
    const dispose = vi.fn();
    const plugin = createTestPlugin({
      id: 'rapid-toggle',
      setup: () => {
        setup();
        return dispose;
      },
    });

    // The toggling itself is the subject, so plugins are assigned after render.
    const { config } = await renderSolution('regular', { plugins: [] });

    config.plugins = [plugin];
    config.plugins = [];
    config.plugins = [plugin];
    config.plugins = [];
    config.plugins = [plugin];

    await vi.waitFor(() => {
      expect(setup).toHaveBeenCalled();
    });
  });

  it('disposes plugins when the uploader is removed from the DOM', async () => {
    const dispose = vi.fn();
    const plugin = createTestPlugin({
      id: 'cleanup-destroy',
      setup: () => dispose,
    });

    await renderSolution('regular', { plugins: [plugin] });

    await vi.waitFor(() => {
      expect(dispose).not.toHaveBeenCalled();
    });

    cleanup();

    await vi.waitFor(() => {
      expect(dispose).toHaveBeenCalledOnce();
    });
  });

  it('works with an empty plugins list', async () => {
    const { root } = await renderSolution('regular', { plugins: [] });

    await openModal(root);
    await expect.element(within(root).getByTestId('uc-start-from')).toBeVisible();
  });
});
