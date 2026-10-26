import { describe, expect, it, vi } from 'vitest';
import { plainText } from '@/abstract/l10n';
import { addSource, createTestPlugin, openModal, renderSolution, within } from '~/tests/utils/render-solution';

describe('plugin sources: expand()', () => {
  it('renders the expanded children instead of the parent', async () => {
    const plugin = createTestPlugin({
      id: 'expandable-plugin',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerSource({
          id: 'parent-source',
          label: plainText('Parent'),
          expand: () => ['child-photo', 'child-video'],
          onSelect: () => {},
        });

        pluginApi.registry.registerSource({
          id: 'child-photo',
          label: plainText('Photo'),
          onSelect: () => {},
        });

        pluginApi.registry.registerSource({
          id: 'child-video',
          label: plainText('Video'),
          onSelect: () => {},
        });
      },
    });

    const { config, root } = await renderSolution('regular', { plugins: [plugin] });
    addSource(config, 'parent-source');

    await openModal(root);

    await expect.element(within(root).getByText('Photo')).toBeVisible();
    await expect.element(within(root).getByText('Video')).toBeVisible();
    await expect.element(within(root).getByText('Parent')).not.toBeInTheDocument();
  });

  it('calls the clicked child’s own onSelect', async () => {
    const onSelectPhoto = vi.fn();
    const onSelectVideo = vi.fn();

    const plugin = createTestPlugin({
      id: 'expand-click-plugin',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerSource({
          id: 'camera-like',
          label: plainText('Camera'),
          expand: () => ['photo-mode', 'video-mode'],
          onSelect: () => {},
        });

        pluginApi.registry.registerSource({
          id: 'photo-mode',
          label: plainText('Take Photo'),
          onSelect: onSelectPhoto,
        });

        pluginApi.registry.registerSource({
          id: 'video-mode',
          label: plainText('Record Video'),
          onSelect: onSelectVideo,
        });
      },
    });

    const { config, root } = await renderSolution('regular', { plugins: [plugin] });
    addSource(config, 'camera-like');

    await openModal(root);

    await within(root).getByText('Take Photo').click();
    await vi.waitFor(() => {
      expect(onSelectPhoto).toHaveBeenCalledOnce();
    });
    expect(onSelectVideo).not.toHaveBeenCalled();
  });

  it('renders the parent when expand() returns its own id', async () => {
    const plugin = createTestPlugin({
      id: 'no-expand-plugin',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerSource({
          id: 'desktop-camera',
          label: plainText('Desktop Camera'),
          expand: () => ['desktop-camera'],
          onSelect: () => {},
        });
      },
    });

    const { config, root } = await renderSolution('regular', { plugins: [plugin] });
    addSource(config, 'desktop-camera');

    await openModal(root);
    await expect.element(within(root).getByText('Desktop Camera')).toBeVisible();
  });

  it('skips expanded ids that are not registered', async () => {
    const plugin = createTestPlugin({
      id: 'missing-expand-plugin',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerSource({
          id: 'partial-expand',
          label: plainText('Partial'),
          expand: () => ['registered-child', 'unregistered-child'],
          onSelect: () => {},
        });

        pluginApi.registry.registerSource({
          id: 'registered-child',
          label: plainText('Registered Child'),
          onSelect: () => {},
        });
      },
    });

    const { config, root } = await renderSolution('regular', { plugins: [plugin] });
    addSource(config, 'partial-expand');

    await openModal(root);
    await expect.element(within(root).getByText('Registered Child')).toBeVisible();
    await expect.element(within(root).getByText('Partial')).not.toBeInTheDocument();
  });
});
