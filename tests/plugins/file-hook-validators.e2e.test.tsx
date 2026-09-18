import { describe, expect, it } from 'vitest';
import { testFile } from '~/tests/fixtures/files';
import { createTestPlugin, renderSolution } from '~/tests/utils/render-solution';

describe('file hook: onAdd with validators', () => {
  it('accepts a file with an empty mime type under imgOnly (no plugin)', async () => {
    const { api } = await renderSolution('regular', { plugins: [], imgOnly: true });

    // A file whose mime type the browser can't determine — validation is skipped
    // so the file passes through even with imgOnly enabled
    const file = testFile('photo.heic', '');
    const entry = api.addFileFromObject(file);

    await expect.poll(() => api.getOutputItem(entry.internalId).errors.length, { timeout: 5000 }).toBe(0);
    const output = api.getOutputItem(entry.internalId);
    expect(output.isFailed).toBe(false);
  });

  it('accepts the file when the hook returns an image mime type under imgOnly', async () => {
    const plugin = createTestPlugin({
      id: 'mime-detector-image',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileHook({
          type: 'onAdd',
          handler({ file }) {
            return { file: new Blob([file], { type: 'image/jpeg' }) };
          },
        });
      },
    });

    const { api } = await renderSolution('regular', { plugins: [plugin], imgOnly: true });

    const file = testFile('photo.heic', '');
    const entry = api.addFileFromObject(file);

    await expect.poll(() => api.getOutputItem(entry.internalId).mimeType, { timeout: 5000 }).toBe('image/jpeg');
    const output = api.getOutputItem(entry.internalId);
    expect(output.isImage).toBe(true);
    expect(output.isFailed).toBe(false);
    expect(output.errors).toHaveLength(0);
  });

  it('rejects the file when the hook returns a non-image mime type under imgOnly', async () => {
    const plugin = createTestPlugin({
      id: 'mime-detector-non-image',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileHook({
          type: 'onAdd',
          handler({ file }) {
            return { file: new Blob([file], { type: 'application/pdf' }) };
          },
        });
      },
    });

    const { api } = await renderSolution('regular', { plugins: [plugin], imgOnly: true });

    const file = testFile('document.bin', '');
    const entry = api.addFileFromObject(file);

    await expect.poll(() => api.getOutputItem(entry.internalId).isFailed, { timeout: 5000 }).toBe(true);
    const output = api.getOutputItem(entry.internalId);
    expect(output.mimeType).toBe('application/pdf');
    expect(output.isImage).toBe(false);
    expect(output.errors[0]?.type).toBe('NOT_AN_IMAGE');
  });

  it('rejects the file when the hook returns a non-image mime type under accept=image/*', async () => {
    const plugin = createTestPlugin({
      id: 'mime-detector-accept',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileHook({
          type: 'onAdd',
          handler({ file }) {
            return { file: new Blob([file], { type: 'application/pdf' }) };
          },
        });
      },
    });

    const { api } = await renderSolution('regular', { plugins: [plugin], accept: 'image/*' });

    const file = testFile('document.bin', '');
    const entry = api.addFileFromObject(file);

    await expect.poll(() => api.getOutputItem(entry.internalId).isFailed, { timeout: 5000 }).toBe(true);
    const output = api.getOutputItem(entry.internalId);
    expect(output.errors.some((e) => e.type === 'FORBIDDEN_FILE_TYPE')).toBe(true);
  });
});
