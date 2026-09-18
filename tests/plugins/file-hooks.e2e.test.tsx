import { describe, expect, it, vi } from 'vitest';
import { delay } from '@/utils/delay';
import { testFile } from '~/tests/fixtures/files';
import { createTestPlugin, renderSolution } from '~/tests/utils/render-solution';

describe('file hook: onAdd', () => {
  it('changes mimeType when the handler returns a Blob of another type', async () => {
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

    const { api } = await renderSolution('regular', { plugins: [plugin] });

    const entry = api.addFileFromObject(testFile('test.jpg'));

    await expect.poll(() => api.getOutputItem(entry.internalId).mimeType).toBe('image/webp');
  });

  it('replaces the file blob', async () => {
    const replacementFile = testFile('transformed.jpg');

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

    const { api } = await renderSolution('regular', { plugins: [plugin] });

    const entry = api.addFileFromObject(testFile('original.jpg'));

    await expect.poll(() => api.getOutputItem(entry.internalId).file).toBe(replacementFile);
  });

  it('derives mimeType, isImage, size and name from the returned file', async () => {
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

    const { api } = await renderSolution('regular', { plugins: [plugin] });

    const file = testFile('original.bin', '');
    const entry = api.addFileFromObject(file);

    await vi.waitFor(() => {
      const output = api.getOutputItem(entry.internalId);
      expect(output.mimeType).toBe('image/jpeg');
      expect(output.isImage).toBe(true);
      expect(output.name).toBe('converted.jpg');
      expect(output.size).toBe(file.size);
    });
  });

  it('chains hooks in registration order, each receiving the previous result', async () => {
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

    const { api } = await renderSolution('regular', { plugins: [pluginA, pluginB] });

    const entry = api.addFileFromObject(testFile('test.txt', 'text/plain'));

    await vi.waitFor(() => {
      expect(calls).toEqual(['a', 'b']);
      expect(api.getOutputItem(entry.internalId).mimeType).toBe('text/html');
    });
  });

  it('keeps running later hooks when one throws', async () => {
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

    const { api } = await renderSolution('regular', { plugins: [pluginA, pluginB] });

    const entry = api.addFileFromObject(testFile('test.txt', 'text/plain'));

    await expect.poll(() => api.getOutputItem(entry.internalId).mimeType).toBe('text/csv');
  });

  it('stops transforming files after the plugin is unregistered', async () => {
    const dispose = vi.fn();
    const plugin = createTestPlugin({
      id: 'hook-unregister',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileHook({
          type: 'onAdd',
          handler({ file }) {
            return { file: new Blob([file], { type: 'image/webp' }) };
          },
        });
        return dispose;
      },
    });

    const { config, api } = await renderSolution('regular', { plugins: [plugin] });
    config.plugins = [];
    await vi.waitFor(() => {
      expect(dispose).toHaveBeenCalledOnce();
    });

    const entry = api.addFileFromObject(testFile('test.jpg'));

    // Negative wait: gives a still-registered hook time to run before asserting it did not.
    await delay(50);

    expect(api.getOutputItem(entry.internalId).mimeType).toBe('image/jpeg');
  });
});

describe('file hook: beforeUpload', () => {
  it('calls the handler with the file before it is uploaded', async () => {
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

    const { api } = await renderSolution('regular', { plugins: [plugin] });

    api.addFileFromObject(testFile('test.jpg'));
    api.uploadAll();

    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0]).toHaveProperty('file');
    });
  });

  it('stops calling the handler after the plugin is unregistered', async () => {
    const handler = vi.fn(({ file }) => ({ file }));
    const dispose = vi.fn();

    const plugin = createTestPlugin({
      id: 'hook-beforeupload-unreg',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileHook({
          type: 'beforeUpload',
          handler,
        });
        return dispose;
      },
    });

    const { config, api } = await renderSolution('regular', { plugins: [plugin] });
    config.plugins = [];
    await vi.waitFor(() => {
      expect(dispose).toHaveBeenCalledOnce();
    });

    api.addFileFromObject(testFile('test.jpg'));
    api.uploadAll();

    // Negative wait: gives a still-registered hook time to run before asserting it did not.
    await delay(100);

    expect(handler).not.toHaveBeenCalled();
  });
});
