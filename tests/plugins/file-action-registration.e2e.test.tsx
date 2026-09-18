import { describe, expect, it, vi } from 'vitest';
import { TEST_IMAGE_URL } from '~/tests/utils/constants';
import { createTestPlugin, renderSolution, within } from '~/tests/utils/render-solution';

describe('plugin file actions', () => {
  it('shows the action button when shouldRender() returns true', async () => {
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
          label: 'Show Action',
          shouldRender: () => true,
          onClick: () => {},
        });
      },
    });

    const { api, root } = await renderSolution('regular', { plugins: [plugin] });

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    await expect.element(within(root).getByRole('button', { name: 'Show Action', exact: true })).toBeVisible();
  });

  it('hides the action button when shouldRender() returns false', async () => {
    const plugin = createTestPlugin({
      id: 'fa-hide',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileAction({
          id: 'hidden-action',
          icon: 'default',
          label: 'Hidden Action',
          shouldRender: () => false,
          onClick: () => {},
        });
      },
    });

    const { api, root } = await renderSolution('regular', { plugins: [plugin] });

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    // Wait for the file item to appear in the upload list
    await expect.element(within(root).getByTestId('uc-upload-list')).toBeVisible();

    // The action button should not be in the DOM
    await expect
      .element(within(root).getByRole('button', { name: 'Hidden Action', exact: true }))
      .not.toBeInTheDocument();
  });

  it('calls onClick() with the entry when the button is clicked', async () => {
    const onClick = vi.fn();
    const plugin = createTestPlugin({
      id: 'fa-click',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileAction({
          id: 'click-action',
          icon: 'default',
          label: 'Click Action',
          shouldRender: () => true,
          onClick,
        });
      },
    });

    const { api, root } = await renderSolution('regular', { plugins: [plugin] });

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    const actionBtn = within(root).getByRole('button', { name: 'Click Action', exact: true });
    await expect.element(actionBtn).toBeVisible();
    await actionBtn.click();

    await vi.waitFor(() => {
      expect(onClick).toHaveBeenCalledOnce();
      const entry = onClick.mock.calls[0][0];
      expect(entry).toHaveProperty('internalId');
      expect(entry).toHaveProperty('status');
    });
  });

  it('re-evaluates shouldRender() when the upload status changes', async () => {
    const shouldRender = vi.fn((entry) => entry.status === 'success');
    const plugin = createTestPlugin({
      id: 'fa-status',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileAction({
          id: 'status-action',
          icon: 'default',
          label: 'Status Action',
          shouldRender,
          onClick: () => {},
        });
      },
    });

    const { api, root } = await renderSolution('regular', { plugins: [plugin] });

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    // After upload completes, the action should appear
    await expect.element(within(root).getByRole('button', { name: 'Status Action', exact: true })).toBeVisible();
  });

  it('hides the action and keeps the file item when shouldRender() throws', async () => {
    const plugin = createTestPlugin({
      id: 'fa-error',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileAction({
          id: 'error-action',
          icon: 'default',
          label: 'Error Action',
          shouldRender: () => {
            throw new Error('shouldRender failed');
          },
          onClick: () => {},
        });
      },
    });

    const { api, root } = await renderSolution('regular', { plugins: [plugin] });

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    await expect.element(within(root).getByTestId('uc-upload-list')).toBeVisible();

    // The action should not appear, but the UI should not be broken
    await expect
      .element(within(root).getByRole('button', { name: 'Error Action', exact: true }))
      .not.toBeInTheDocument();

    // The file item should still be visible and functional
    await expect.element(within(root).getByText('prithiviraj-a-fa7Stge3YXs-unsplash.jpg')).toBeVisible();
  });

  it('removes the action when the plugin is unregistered', async () => {
    const plugin = createTestPlugin({
      id: 'fa-remove',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileAction({
          id: 'remove-file-action',
          icon: 'default',
          label: 'Remove File Action',
          shouldRender: () => true,
          onClick: () => {},
        });
      },
    });

    const { config, api, root } = await renderSolution('regular', { plugins: [plugin] });

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    await expect.element(within(root).getByRole('button', { name: 'Remove File Action', exact: true })).toBeVisible();

    config.plugins = [];

    await expect
      .element(within(root).getByRole('button', { name: 'Remove File Action', exact: true }))
      .not.toBeInTheDocument();
  });

  it('purges actions and icons when setup() throws', async () => {
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
          label: 'Temp Action',
          shouldRender: () => true,
          onClick: () => {},
        });
        throw new Error('fail setup');
      },
    });

    const { api, root } = await renderSolution('regular', { plugins: [plugin] });

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    await expect
      .element(within(root).getByRole('button', { name: 'Temp Action', exact: true }))
      .not.toBeInTheDocument();
  });

  it('renders actions from several plugins on the same file', async () => {
    const pluginA = createTestPlugin({
      id: 'fa-multi-a',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileAction({
          id: 'action-a',
          icon: 'default',
          label: 'Action A',
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
          label: 'Action B',
          shouldRender: () => true,
          onClick: () => {},
        });
      },
    });

    const { api, root } = await renderSolution('regular', { plugins: [pluginA, pluginB] });

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    await expect.element(within(root).getByRole('button', { name: 'Action A', exact: true })).toBeVisible();
    await expect.element(within(root).getByRole('button', { name: 'Action B', exact: true })).toBeVisible();
  });

  it('keeps the button and file item when onClick throws', async () => {
    const plugin = createTestPlugin({
      id: 'fa-onclick-error',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileAction({
          id: 'error-onclick',
          icon: 'default',
          label: 'Error OnClick',
          shouldRender: () => true,
          onClick: () => {
            throw new Error('boom');
          },
        });
      },
    });

    const { api, root } = await renderSolution('regular', { plugins: [plugin] });

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    const btn = within(root).getByRole('button', { name: 'Error OnClick', exact: true });
    await expect.element(btn).toBeVisible();
    await btn.click();

    // File item and button should remain present even if handler throws
    await expect.element(btn).toBeVisible();
    await expect.element(within(root).getByText('prithiviraj-a-fa7Stge3YXs-unsplash.jpg')).toBeVisible();
  });
});
