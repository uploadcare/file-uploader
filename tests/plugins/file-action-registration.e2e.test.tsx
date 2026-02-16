import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { createTestPlugin, getApi, renderUploader, TEST_IMAGE_URL } from './utils';

describe('File Action Registration', () => {
  it('should show file action button when shouldRender() returns true', async () => {
    const plugin = createTestPlugin({
      id: 'fa-show',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerIcon({
          name: 'test-action-icon',
          svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>',
        });
        pluginApi.registry.registerFileAction({
          id: 'show-action',
          icon: 'test-action-icon',
          shouldRender: () => true,
          onClick: () => {},
        });
      },
    });

    await renderUploader([plugin]);
    const api = getApi();

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    await expect.element(page.getByRole('button', { name: 'show-action' })).toBeVisible();
  });

  it('should hide file action button when shouldRender() returns false', async () => {
    const plugin = createTestPlugin({
      id: 'fa-hide',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileAction({
          id: 'hidden-action',
          icon: 'default',
          shouldRender: () => false,
          onClick: () => {},
        });
      },
    });

    await renderUploader([plugin]);
    const api = getApi();

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    // Wait for the file item to appear in the upload list
    await expect.element(page.getByTestId('uc-upload-list')).toBeVisible();

    // The action button should not be in the DOM
    await expect.element(page.getByRole('button', { name: 'hidden-action' })).not.toBeInTheDocument();
  });

  it('should call onClick() when file action button is clicked', async () => {
    const onClick = vi.fn();
    const plugin = createTestPlugin({
      id: 'fa-click',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileAction({
          id: 'click-action',
          icon: 'default',
          shouldRender: () => true,
          onClick,
        });
      },
    });

    await renderUploader([plugin]);
    const api = getApi();

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    const actionBtn = page.getByRole('button', { name: 'click-action' });
    await expect.element(actionBtn).toBeVisible();
    await actionBtn.click();

    await vi.waitFor(() => {
      expect(onClick).toHaveBeenCalledOnce();
      const entry = onClick.mock.calls[0][0];
      expect(entry).toHaveProperty('internalId');
      expect(entry).toHaveProperty('status');
    });
  });

  it('should update file actions when file upload status changes', async () => {
    const shouldRender = vi.fn((entry) => entry.status === 'success');
    const plugin = createTestPlugin({
      id: 'fa-status',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileAction({
          id: 'status-action',
          icon: 'default',
          shouldRender,
          onClick: () => {},
        });
      },
    });

    await renderUploader([plugin]);
    const api = getApi();

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    // After upload completes, the action should appear
    await expect.element(page.getByRole('button', { name: 'status-action' })).toBeVisible();
  });

  it('should handle shouldRender() throwing an error gracefully', async () => {
    const plugin = createTestPlugin({
      id: 'fa-error',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileAction({
          id: 'error-action',
          icon: 'default',
          shouldRender: () => {
            throw new Error('shouldRender failed');
          },
          onClick: () => {},
        });
      },
    });

    await renderUploader([plugin]);
    const api = getApi();

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    await expect.element(page.getByTestId('uc-upload-list')).toBeVisible();

    // The action should not appear, but the UI should not be broken
    await expect.element(page.getByRole('button', { name: 'error-action' })).not.toBeInTheDocument();

    // The file item should still be visible and functional
    await expect.element(page.getByText('prithiviraj-a-fa7Stge3YXs-unsplash.jpg')).toBeVisible();
  });

  it('should remove file actions when plugin is unregistered', async () => {
    const plugin = createTestPlugin({
      id: 'fa-remove',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileAction({
          id: 'remove-file-action',
          icon: 'default',
          shouldRender: () => true,
          onClick: () => {},
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    const api = getApi();

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    await expect.element(page.getByRole('button', { name: 'remove-file-action' })).toBeVisible();

    config.plugins = [];

    await expect.element(page.getByRole('button', { name: 'remove-file-action' })).not.toBeInTheDocument();
  });

  it('should purge file actions and icons when setup throws', async () => {
    const plugin = createTestPlugin({
      id: 'fa-throw-setup',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerIcon({
          name: 'temp-icon',
          svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>',
        });
        pluginApi.registry.registerFileAction({
          id: 'temp-action',
          icon: 'temp-icon',
          shouldRender: () => true,
          onClick: () => {},
        });
        throw new Error('fail setup');
      },
    });

    await renderUploader([plugin]);
    const api = getApi();

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    await expect.element(page.getByRole('button', { name: 'temp-action' })).not.toBeInTheDocument();
  });

  it('should render multiple actions from different plugins on the same file', async () => {
    const pluginA = createTestPlugin({
      id: 'fa-multi-a',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileAction({
          id: 'action-a',
          icon: 'default',
          shouldRender: () => true,
          onClick: () => {},
        });
      },
    });

    const pluginB = createTestPlugin({
      id: 'fa-multi-b',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileAction({
          id: 'action-b',
          icon: 'default',
          shouldRender: () => true,
          onClick: () => {},
        });
      },
    });

    await renderUploader([pluginA, pluginB]);
    const api = getApi();

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    await expect.element(page.getByRole('button', { name: 'action-a' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'action-b' })).toBeVisible();
  });

  it('should tolerate onClick throwing without breaking UI', async () => {
    const plugin = createTestPlugin({
      id: 'fa-onclick-error',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileAction({
          id: 'error-onclick',
          icon: 'default',
          shouldRender: () => true,
          onClick: () => {
            throw new Error('boom');
          },
        });
      },
    });

    await renderUploader([plugin]);
    const api = getApi();

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    const btn = page.getByRole('button', { name: 'error-onclick' });
    await expect.element(btn).toBeVisible();
    await btn.click();

    // File item and button should remain present even if handler throws
    await expect.element(btn).toBeVisible();
    await expect.element(page.getByText('prithiviraj-a-fa7Stge3YXs-unsplash.jpg')).toBeVisible();
  });
});
