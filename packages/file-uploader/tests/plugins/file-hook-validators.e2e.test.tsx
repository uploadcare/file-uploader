import { describe, expect, it } from 'vitest';
import { createTestPlugin, getApi, renderUploader } from './utils';

describe('onAdd hook + validators integration', () => {
  it('should allow file with empty mime type when imgOnly is set (no plugin)', async () => {
    const { config } = await renderUploader([]);
    config.imgOnly = true;
    const api = getApi();

    // A file whose mime type the browser can't determine — validation is skipped
    // so the file passes through even with imgOnly enabled
    const file = new File(['content'], 'photo.heic', { type: '' });
    const entry = api.addFileFromObject(file);

    await expect.poll(() => api.getOutputItem(entry.internalId).errors.length, { timeout: 5000 }).toBe(0);
    const output = api.getOutputItem(entry.internalId);
    expect(output.isFailed).toBe(false);
  });

  it('should allow image file when plugin returns a file with image mime type', async () => {
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

    const { config } = await renderUploader([plugin]);
    config.imgOnly = true;
    const api = getApi();

    const file = new File(['content'], 'photo.heic', { type: '' });
    const entry = api.addFileFromObject(file);

    await expect.poll(() => api.getOutputItem(entry.internalId).mimeType, { timeout: 5000 }).toBe('image/jpeg');
    const output = api.getOutputItem(entry.internalId);
    expect(output.isImage).toBe(true);
    expect(output.isFailed).toBe(false);
    expect(output.errors).toHaveLength(0);
  });

  it('should deny non-image when plugin returns a file with non-image mime type with imgOnly', async () => {
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

    const { config } = await renderUploader([plugin]);
    config.imgOnly = true;
    const api = getApi();

    const file = new File(['content'], 'document.bin', { type: '' });
    const entry = api.addFileFromObject(file);

    await expect.poll(() => api.getOutputItem(entry.internalId).isFailed, { timeout: 5000 }).toBe(true);
    const output = api.getOutputItem(entry.internalId);
    expect(output.mimeType).toBe('application/pdf');
    expect(output.isImage).toBe(false);
    expect(output.errors[0]?.type).toBe('NOT_AN_IMAGE');
  });

  it('should deny file when plugin returns non-image mime type and accept restricts to images', async () => {
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

    const { config } = await renderUploader([plugin]);
    config.accept = 'image/*';
    const api = getApi();

    const file = new File(['content'], 'document.bin', { type: '' });
    const entry = api.addFileFromObject(file);

    await expect.poll(() => api.getOutputItem(entry.internalId).isFailed, { timeout: 5000 }).toBe(true);
    const output = api.getOutputItem(entry.internalId);
    expect(output.errors.some((e) => e.type === 'FORBIDDEN_FILE_TYPE')).toBe(true);
  });
});
