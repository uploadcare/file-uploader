import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { PluginSetupParams } from '@/index.ts';
import { addSource, createTestPlugin, openModal, renderUploader } from './utils';

describe('Plugin Registration & Lifecycle', () => {
  it('should register a plugin when added to config.plugins', async () => {
    const setup = vi.fn<(params: PluginSetupParams) => void>();
    const plugin = createTestPlugin({ id: 'test-register', setup });

    await renderUploader([plugin]);

    await vi.waitFor(() => {
      expect(setup).toHaveBeenCalledOnce();
    });
  });

  it('should call plugin setup() with pluginApi and uploaderApi', async () => {
    const setup = vi.fn<(params: PluginSetupParams) => void>();
    const plugin = createTestPlugin({ id: 'test-setup-args', setup });

    await renderUploader([plugin]);

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
    expect(args.pluginApi.registry).toHaveProperty('registerI18n');
    expect(args.pluginApi.registry).toHaveProperty('registerConfig');
  });

  it('should unregister a plugin when removed from config.plugins', async () => {
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

    const { config } = await renderUploader([plugin]);

    await vi.waitFor(() => {
      expect(setup).toHaveBeenCalledOnce();
    });

    config.sourceList += ',temp-source';
    await openModal();
    await expect.element(page.getByText('Temp Source')).toBeVisible();

    // Remove the plugin
    config.plugins = [];

    // The source should no longer appear
    await expect.element(page.getByText('Temp Source')).not.toBeInTheDocument();
  });

  it('should call plugin dispose() on unregister', async () => {
    const dispose = vi.fn();
    const plugin = createTestPlugin({
      id: 'test-dispose',
      setup: () => ({ dispose }),
    });

    const { config } = await renderUploader([plugin]);

    await vi.waitFor(() => {
      expect(dispose).not.toHaveBeenCalled();
    });

    config.plugins = [];

    await vi.waitFor(() => {
      expect(dispose).toHaveBeenCalledOnce();
    });
  });

  it('should handle adding multiple plugins', async () => {
    const setup1 = vi.fn();
    const setup2 = vi.fn();

    const plugin1 = createTestPlugin({ id: 'multi-1', setup: setup1 });
    const plugin2 = createTestPlugin({ id: 'multi-2', setup: setup2 });

    await renderUploader([plugin1, plugin2]);

    await vi.waitFor(() => {
      expect(setup1).toHaveBeenCalledOnce();
      expect(setup2).toHaveBeenCalledOnce();
    });
  });

  it('should handle replacing plugins (remove old, add new)', async () => {
    const dispose1 = vi.fn();
    const setup2 = vi.fn();

    const plugin1 = createTestPlugin({
      id: 'replace-old',
      setup: () => ({ dispose: dispose1 }),
    });
    const plugin2 = createTestPlugin({ id: 'replace-new', setup: setup2 });

    const { config } = await renderUploader([plugin1]);

    await vi.waitFor(() => {
      expect(dispose1).not.toHaveBeenCalled();
    });

    config.plugins = [plugin2];

    await vi.waitFor(() => {
      expect(dispose1).toHaveBeenCalledOnce();
      expect(setup2).toHaveBeenCalledOnce();
    });
  });

  it('should purge all registrations when plugin setup() throws', async () => {
    const plugin = createTestPlugin({
      id: 'test-setup-error',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerSource({
          id: 'error-source',
          label: 'Error Source',
          onSelect: () => {},
        });
        throw new Error('setup failed');
      },
    });

    const { config } = await renderUploader([plugin]);
    config.sourceList += ',error-source';

    await openModal();

    // Source should not be present since setup threw
    await expect.element(page.getByText('Error Source')).not.toBeInTheDocument();
  });

  it('should not break other plugins if one plugin setup() throws', async () => {
    const failingPlugin = createTestPlugin({
      id: 'failing-plugin',
      setup: () => {
        throw new Error('fail');
      },
    });

    const workingSetup = vi.fn<(params: PluginSetupParams) => void>(({ pluginApi }) => {
      pluginApi.registry.registerSource({
        id: 'working-source',
        label: 'Working Source',
        onSelect: () => {},
      });
    });
    const workingPlugin = createTestPlugin({ id: 'working-plugin', setup: workingSetup });

    const { config } = await renderUploader([failingPlugin, workingPlugin]);
    config.sourceList += ',working-source';

    await vi.waitFor(() => {
      expect(workingSetup).toHaveBeenCalledOnce();
    });

    await openModal();
    await expect.element(page.getByText('Working Source')).toBeVisible();
  });

  it('should await async setup() and register outputs', async () => {
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

    const { config } = await renderUploader([plugin]);
    addSource(config, 'async-source');

    await openModal();
    await expect.element(page.getByText('Async Source')).toBeVisible();
  });

  it('should await async setup() dispose() on unregister', async () => {
    const dispose = vi.fn();
    const plugin = createTestPlugin({
      id: 'async-dispose',
      setup: async () => {
        await Promise.resolve();
        return { dispose };
      },
    });

    const { config } = await renderUploader([plugin]);

    await vi.waitFor(() => {
      expect(dispose).not.toHaveBeenCalled();
    });

    config.plugins = [];

    await vi.waitFor(() => {
      expect(dispose).toHaveBeenCalledOnce();
    });
  });
});
