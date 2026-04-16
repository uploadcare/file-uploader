import { describe, expect, it, vi } from 'vitest';
import { delay } from '@/utils/delay';
import { createTestPlugin, getApi, renderUploader } from './utils';

describe('File Hook Registration', () => {
  describe('onAdd', () => {
    it('should transform mimeType by returning a new Blob with a different type', async () => {
      const plugin = createTestPlugin({
        id: 'hook-onadd-mime',
        setup: ({ pluginApi }) => {
          pluginApi.registry.registerFileHook({
            type: 'onAdd',
            async handler({ file }) {
              return { file: new Blob([file], { type: 'image/webp' }) };
            },
          });
        },
      });

      await renderUploader([plugin]);
      const api = getApi();

      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const entry = api.addFileFromObject(file);

      await vi.waitFor(() => {
        const output = api.getOutputItem(entry.internalId);
        expect(output.mimeType).toBe('image/webp');
      });
    });

    it('should replace the file blob', async () => {
      const replacementFile = new File(['new content'], 'transformed.jpg', { type: 'image/jpeg' });

      const plugin = createTestPlugin({
        id: 'hook-onadd-file',
        setup: ({ pluginApi }) => {
          pluginApi.registry.registerFileHook({
            type: 'onAdd',
            async handler() {
              return { file: replacementFile };
            },
          });
        },
      });

      await renderUploader([plugin]);
      const api = getApi();

      const original = new File(['original'], 'original.jpg', { type: 'image/jpeg' });
      const entry = api.addFileFromObject(original);

      await vi.waitFor(() => {
        const output = api.getOutputItem(entry.internalId);
        expect(output.file).toBe(replacementFile);
      });
    });

    it('should derive mimeType, isImage, fileSize and fileName from the returned file', async () => {
      const plugin = createTestPlugin({
        id: 'hook-onadd-derived',
        setup: ({ pluginApi }) => {
          pluginApi.registry.registerFileHook({
            type: 'onAdd',
            handler({ file }) {
              return { file: new File([file], 'converted.jpg', { type: 'image/jpeg' }) };
            },
          });
        },
      });

      await renderUploader([plugin]);
      const api = getApi();

      const file = new File(['content'], 'original.bin', { type: '' });
      const entry = api.addFileFromObject(file);

      await vi.waitFor(() => {
        const output = api.getOutputItem(entry.internalId);
        expect(output.mimeType).toBe('image/jpeg');
        expect(output.isImage).toBe(true);
        expect(output.name).toBe('converted.jpg');
        expect(output.size).toBe(file.size);
      });
    });

    it('should chain multiple onAdd hooks in registration order', async () => {
      const calls: string[] = [];

      const pluginA = createTestPlugin({
        id: 'hook-chain-a',
        setup: ({ pluginApi }) => {
          pluginApi.registry.registerFileHook({
            type: 'onAdd',
            async handler({ file }) {
              calls.push('a');
              return { file: new Blob([file], { type: 'text/plain' }) };
            },
          });
        },
      });

      const pluginB = createTestPlugin({
        id: 'hook-chain-b',
        setup: ({ pluginApi }) => {
          pluginApi.registry.registerFileHook({
            type: 'onAdd',
            handler({ file }) {
              calls.push('b');
              // Receives the file returned by hook A
              expect(file.type).toBe('text/plain');
              return { file: new Blob([file], { type: 'text/html' }) };
            },
          });
        },
      });

      await renderUploader([pluginA, pluginB]);
      const api = getApi();

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const entry = api.addFileFromObject(file);

      await vi.waitFor(() => {
        expect(calls).toEqual(['a', 'b']);
        const output = api.getOutputItem(entry.internalId);
        expect(output.mimeType).toBe('text/html');
      });
    });

    it('should continue running subsequent hooks if one throws', async () => {
      const pluginA = createTestPlugin({
        id: 'hook-error-a',
        setup: ({ pluginApi }) => {
          pluginApi.registry.registerFileHook({
            type: 'onAdd',
            handler() {
              throw new Error('hook A failed');
            },
          });
        },
      });

      const pluginB = createTestPlugin({
        id: 'hook-error-b',
        setup: ({ pluginApi }) => {
          pluginApi.registry.registerFileHook({
            type: 'onAdd',
            handler({ file }) {
              return { file: new Blob([file], { type: 'text/csv' }) };
            },
          });
        },
      });

      await renderUploader([pluginA, pluginB]);
      const api = getApi();

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const entry = api.addFileFromObject(file);

      await vi.waitFor(() => {
        const output = api.getOutputItem(entry.internalId);
        expect(output.mimeType).toBe('text/csv');
      });
    });

    it('should not transform files after plugin is unregistered', async () => {
      const plugin = createTestPlugin({
        id: 'hook-unregister',
        setup: ({ pluginApi }) => {
          pluginApi.registry.registerFileHook({
            type: 'onAdd',
            handler({ file }) {
              return { file: new Blob([file], { type: 'image/webp' }) };
            },
          });
        },
      });

      const { config } = await renderUploader([plugin]);
      config.plugins = [];

      // Wait for plugin to be unregistered
      await delay(0);

      const api = getApi();
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const entry = api.addFileFromObject(file);

      // Give enough time for hooks to run if they were still registered
      await delay(50);

      const output = api.getOutputItem(entry.internalId);
      expect(output.mimeType).toBe('image/jpeg');
    });
  });

  describe('beforeUpload', () => {
    it('should call handler before the file is uploaded', async () => {
      const handler = vi.fn(({ file }) => ({ file }));

      const plugin = createTestPlugin({
        id: 'hook-beforeupload',
        setup: ({ pluginApi }) => {
          pluginApi.registry.registerFileHook({
            type: 'beforeUpload',
            handler,
          });
        },
      });

      await renderUploader([plugin]);
      const api = getApi();

      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      api.addFileFromObject(file);
      api.uploadAll();

      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledOnce();
        const ctx = handler.mock.calls[0][0];
        expect(ctx).toHaveProperty('file');
      });
    });

    it('should not run beforeUpload hook after plugin is unregistered', async () => {
      const handler = vi.fn(({ file }) => ({ file }));

      const plugin = createTestPlugin({
        id: 'hook-beforeupload-unreg',
        setup: ({ pluginApi }) => {
          pluginApi.registry.registerFileHook({
            type: 'beforeUpload',
            handler,
          });
        },
      });

      const { config } = await renderUploader([plugin]);
      config.plugins = [];

      await delay(0);

      const api = getApi();
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      api.addFileFromObject(file);
      api.uploadAll();

      await delay(100);

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
