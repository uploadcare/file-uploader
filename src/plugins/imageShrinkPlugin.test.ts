import { describe, expect, it, vi } from 'vitest';
import type { PluginApi } from '../abstract/managers/plugin/PluginTypes';
import { imageShrinkPlugin } from './imageShrinkPlugin';

vi.mock('@uploadcare/image-shrink', () => ({
  shrinkFile: vi.fn(() => Promise.reject(new Error('canvas too large'))),
}));

type Hook = (args: { file: File }) => Promise<{ file: File }>;

describe('imageShrinkPlugin', () => {
  it('warns and uploads the original when shrinking fails', async () => {
    let handler: Hook | undefined;
    const warn = vi.fn();
    // Only what the plugin touches; the boundary cast is the one place the partial api meets the full type.
    const pluginApi = {
      config: { get: () => '800x600' },
      logger: { warn },
      registry: { registerFileHook: (hook: { handler: Hook }) => (handler = hook.handler) },
    } as unknown as PluginApi;
    await imageShrinkPlugin.setup({ pluginApi } as Parameters<typeof imageShrinkPlugin.setup>[0]);
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });

    const result = await handler?.({ file });

    expect(result?.file).toBe(file);
    expect(warn).toHaveBeenCalledWith('Image shrink failed, uploading the original', expect.any(Error));
  });
});
