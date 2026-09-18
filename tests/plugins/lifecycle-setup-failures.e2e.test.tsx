import { describe, expect, it, vi } from 'vitest';
import type { PluginSetupParams, UploaderPlugin } from '@/index.ts';
import { addSource, createTestPlugin, openModal, renderSolution, within } from '~/tests/utils/render-solution';

describe('plugin lifecycle: setup failures', () => {
  it('purges every registration when setup() throws', async () => {
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

    const { config, root } = await renderSolution('regular', { plugins: [plugin] });
    addSource(config, 'error-source');

    await openModal(root);

    await expect.element(within(root).getByText('Error Source')).not.toBeInTheDocument();
  });

  it('keeps other plugins working when one setup() throws', async () => {
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

    const { config, root } = await renderSolution('regular', { plugins: [failingPlugin, workingPlugin] });
    addSource(config, 'working-source');

    await vi.waitFor(() => {
      expect(workingSetup).toHaveBeenCalledOnce();
    });

    await openModal(root);
    await expect.element(within(root).getByText('Working Source')).toBeVisible();
  });

  it('warns and skips the second plugin when two share an id', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const setup1 = vi.fn();
    const setup2 = vi.fn();
    const plugin1 = createTestPlugin({ id: 'dup-id', setup: setup1 });
    const plugin2 = createTestPlugin({ id: 'dup-id', setup: setup2 });

    await renderSolution('regular', { plugins: [plugin1, plugin2] });

    await vi.waitFor(() => {
      expect(setup1).toHaveBeenCalledOnce();
    });

    expect(setup2).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"dup-id"'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('duplicate'));

    warnSpy.mockRestore();
  });

  it('logs an error when setup() throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const plugin = createTestPlugin({
      id: 'setup-throws',
      setup: () => {
        throw new Error('intentional failure');
      },
    });

    await renderSolution('regular', { plugins: [plugin] });

    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('"setup-throws"'), expect.any(Error));
    });

    errorSpy.mockRestore();
  });

  it('logs an error when an async setup() rejects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const plugin = createTestPlugin({
      id: 'async-setup-rejects',
      setup: async () => {
        await Promise.resolve();
        throw new Error('async failure');
      },
    });

    await renderSolution('regular', { plugins: [plugin] });

    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('"async-setup-rejects"'), expect.any(Error));
    });

    errorSpy.mockRestore();
  });

  it('warns and skips a plugin without an id', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const setupFn = vi.fn();
    const pluginWithoutId = { setup: setupFn } as unknown as UploaderPlugin;

    await renderSolution('regular', { plugins: [pluginWithoutId] });

    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"id"'));
    });

    expect(setupFn).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
