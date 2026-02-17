import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { addSource, createTestPlugin, openModal, renderUploader, TEST_IMAGE_URL } from './utils';

describe('Uploader API (from plugin)', () => {
  it('should allow adding files via uploaderApi.addFileFromUrl()', async () => {
    const plugin = createTestPlugin({
      id: 'uapi-url',
      setup: ({ pluginApi, uploaderApi }) => {
        pluginApi.registry.registerSource({
          id: 'url-add-source',
          label: 'Add URL',
          onSelect: () => {
            uploaderApi.addFileFromUrl(TEST_IMAGE_URL);
            uploaderApi.setCurrentActivity('upload-list');
            uploaderApi.setModalState(true);
          },
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    addSource(config, 'url-add-source');

    await openModal();
    await page.getByText('Add URL').click();

    await expect.element(page.getByText('prithiviraj-a-fa7Stge3YXs-unsplash.jpg')).toBeVisible();
  });

  it('should allow adding files via uploaderApi.addFileFromObject()', async () => {
    const plugin = createTestPlugin({
      id: 'uapi-object',
      setup: ({ pluginApi, uploaderApi }) => {
        pluginApi.registry.registerSource({
          id: 'obj-add-source',
          label: 'Add Object',
          onSelect: () => {
            const file = new File(['test content'], 'test-file.txt', { type: 'text/plain' });
            uploaderApi.addFileFromObject(file);
            uploaderApi.setCurrentActivity('upload-list');
            uploaderApi.setModalState(true);
          },
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    addSource(config, 'obj-add-source');

    await openModal();
    await page.getByText('Add Object').click();

    await expect.element(page.getByText('test-file.txt')).toBeVisible();
  });

  it('should allow calling setCurrentActivity() to switch activities', async () => {
    const plugin = createTestPlugin({
      id: 'uapi-activity',
      setup: ({ pluginApi, uploaderApi }) => {
        pluginApi.registry.registerActivity({
          id: 'switchable-activity',
          render: (el) => {
            el.textContent = 'Switched Activity';
            return () => el.replaceChildren();
          },
        });

        pluginApi.registry.registerSource({
          id: 'switch-source',
          label: 'Switch Activity',
          onSelect: () => {
            uploaderApi.setCurrentActivity('switchable-activity');
            uploaderApi.setModalState(true);
          },
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    addSource(config, 'switch-source');

    await openModal();
    await page.getByText('Switch Activity').click();

    await expect.element(page.getByText('Switched Activity')).toBeVisible();
  });

  it('should allow calling setModalState() to open/close modal', async () => {
    const plugin = createTestPlugin({
      id: 'uapi-modal',
      setup: ({ pluginApi, uploaderApi }) => {
        pluginApi.registry.registerSource({
          id: 'modal-source',
          label: 'Toggle Modal',
          onSelect: () => {
            uploaderApi.setModalState(false);
          },
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    addSource(config, 'modal-source');

    await openModal();
    const startFrom = page.getByTestId('uc-start-from');
    await expect.element(startFrom).toBeVisible();

    await page.getByText('Toggle Modal').click();

    await expect.element(startFrom).not.toBeVisible();
  });

  it('should allow calling initFlow() / doneFlow()', async () => {
    const plugin = createTestPlugin({
      id: 'uapi-flow',
      setup: ({ pluginApi, uploaderApi }) => {
        pluginApi.registry.registerSource({
          id: 'flow-source',
          label: 'Start Flow',
          onSelect: () => {
            uploaderApi.addFileFromUrl(TEST_IMAGE_URL);
            uploaderApi.initFlow();
          },
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    addSource(config, 'flow-source');

    await openModal();
    await page.getByText('Start Flow').click();

    await expect.element(page.getByTestId('uc-upload-list')).toBeVisible();
  });
});

declare module '@/types/index' {
  interface CustomActivities {
    'switchable-activity': {
      params: never;
    };
  }
}
