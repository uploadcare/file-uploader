import { shrinkFile } from '@uploadcare/image-shrink';
import { describe, expect, it, vi } from 'vitest';
import type { PluginApi } from '../abstract/managers/plugin/PluginTypes';
import { imageShrinkPlugin } from './imageShrinkPlugin';

vi.mock('@uploadcare/image-shrink', () => ({
  shrinkFile: vi.fn(() => Promise.reject(new Error('canvas too large'))),
}));

type Hook = (args: { file: File }) => Promise<{ file: File }>;

const runHook = async () => {
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
  return { file, result, warn };
};

describe('imageShrinkPlugin', () => {
  it('warns and uploads the original when shrinking fails', async () => {
    const { file, result, warn } = await runHook();

    expect(result?.file).toBe(file);
    expect(warn).toHaveBeenCalledWith('Image shrink failed, uploading the original', expect.any(Error));
  });

  it('uploads the original without a warning when the image is already under the limit', async () => {
    // image-shrink's way of saying there is nothing to do.
    vi.mocked(shrinkFile).mockRejectedValueOnce(new Error('Not required'));

    const { file, result, warn } = await runHook();

    expect(result?.file).toBe(file);
    expect(warn).not.toHaveBeenCalled();
  });

  it('uploads the original without a warning when image-shrink wraps its "Not required" error', async () => {
    // shrinkFile rethrows every inner failure in this shape (index.browser.mjs, the catch at the end of shrinkFile).
    vi.mocked(shrinkFile).mockRejectedValueOnce(
      new Error('Failed to shrink image. Message: "Not required".', { cause: new Error('Not required') }),
    );

    const { file, result, warn } = await runHook();

    expect(result?.file).toBe(file);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when image-shrink wraps a real failure', async () => {
    vi.mocked(shrinkFile).mockRejectedValueOnce(
      new Error('Failed to shrink image. Message: "Not supported".', { cause: 'Not supported' }),
    );

    const { warn } = await runHook();

    expect(warn).toHaveBeenCalledWith('Image shrink failed, uploading the original', expect.any(Error));
  });
});
