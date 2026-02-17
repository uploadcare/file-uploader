import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { cleanup, createTestPlugin, openModal, renderUploader } from './utils';

describe('Cleanup & Edge Cases', () => {
  it('should clean up everything on component destroy', async () => {
    const dispose = vi.fn();
    const plugin = createTestPlugin({
      id: 'cleanup-destroy',
      setup: () => ({ dispose }),
    });

    await renderUploader([plugin]);

    await vi.waitFor(() => {
      expect(dispose).not.toHaveBeenCalled();
    });

    // Remove all rendered components
    cleanup();

    await vi.waitFor(() => {
      expect(dispose).toHaveBeenCalledOnce();
    });
  });

  it('should handle plugin being added and removed rapidly', async () => {
    const setup = vi.fn();
    const dispose = vi.fn();
    const plugin = createTestPlugin({
      id: 'rapid-toggle',
      setup: () => {
        setup();
        return { dispose };
      },
    });

    const { config } = await renderUploader([]);

    // Rapidly add and remove
    config.plugins = [plugin];
    config.plugins = [];
    config.plugins = [plugin];
    config.plugins = [];
    config.plugins = [plugin];

    await vi.waitFor(() => {
      expect(setup).toHaveBeenCalled();
    });

    // The final state should have the plugin registered
    await vi.waitFor(() => {
      expect(setup.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should handle duplicate plugin IDs (re-register)', async () => {
    const dispose1 = vi.fn();
    const setup2 = vi.fn();

    const plugin1 = createTestPlugin({
      id: 'duplicate-id',
      setup: () => ({ dispose: dispose1 }),
    });

    const plugin2 = createTestPlugin({
      id: 'duplicate-id',
      setup: setup2,
    });

    const { config } = await renderUploader([plugin1]);

    await vi.waitFor(() => {
      expect(dispose1).not.toHaveBeenCalled();
    });

    // Replace with same-id plugin
    config.plugins = [plugin2];

    await vi.waitFor(() => {
      expect(dispose1).toHaveBeenCalledOnce();
      expect(setup2).toHaveBeenCalledOnce();
    });
  });

  it('should only register the first plugin when two plugins have the same id', async () => {
    const setup1 = vi.fn();
    const setup2 = vi.fn();

    const plugin1 = createTestPlugin({
      id: 'same-id',
      setup: setup1,
    });

    const plugin2 = createTestPlugin({
      id: 'same-id',
      setup: setup2,
    });

    await renderUploader([plugin1, plugin2]);

    await vi.waitFor(() => {
      expect(setup1).toHaveBeenCalledOnce();
    });

    // Second plugin with same id should not be registered
    expect(setup2).not.toHaveBeenCalled();
  });

  it('should not break when no plugins are registered', async () => {
    await renderUploader([]);

    await openModal();
    await expect.element(page.getByTestId('uc-start-from')).toBeVisible();
  });
});
