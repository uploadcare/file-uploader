import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { instagramPlugin } from '@/plugins/instagramPlugin';
import { addSource, createTestPlugin, openModal, renderUploader } from './utils';

describe('Source Registration', () => {
  it('should show registered source in the source list', async () => {
    const plugin = createTestPlugin({
      id: 'src-plugin',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerSource({
          id: 'my-source',
          label: 'My Custom Source',
          onSelect: () => {},
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    addSource(config, 'my-source');

    await openModal();
    await expect.element(page.getByText('My Custom Source')).toBeVisible();
  });

  it('should call onSelect when source is clicked', async () => {
    const onSelect = vi.fn();
    const plugin = createTestPlugin({
      id: 'src-click',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerSource({
          id: 'click-source',
          label: 'Click Me',
          onSelect,
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    addSource(config, 'click-source');

    await openModal();
    await page.getByText('Click Me').click();

    await vi.waitFor(() => {
      expect(onSelect).toHaveBeenCalledOnce();
    });
  });

  it('should display the source with i18n label', async () => {
    const plugin = createTestPlugin({
      id: 'src-i18n',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerI18n({
          en: {
            'src-type-custom': 'Translated Source',
          },
        });

        pluginApi.registry.registerSource({
          id: 'i18n-source',
          label: 'src-type-custom',
          onSelect: () => {},
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    addSource(config, 'i18n-source');

    await openModal();
    await expect.element(page.getByText('Translated Source')).toBeVisible();
  });

  it('should remove source from list when plugin is unregistered', async () => {
    const plugin = createTestPlugin({
      id: 'src-remove',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerSource({
          id: 'removable-source',
          label: 'Removable Source',
          onSelect: () => {},
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    addSource(config, 'removable-source');

    await openModal();
    await expect.element(page.getByText('Removable Source')).toBeVisible();

    config.plugins = [];

    await expect.element(page.getByText('Removable Source')).not.toBeInTheDocument();
  });

  it('should print console.error and not render a source button for deprecated instagram source', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { config } = await renderUploader([instagramPlugin]);
      addSource(config, 'instagram');

      await openModal();

      await vi.waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Instagram source was removed'));
      });

      await expect.element(document.querySelector<HTMLElement>('[data-source-id="instagram"]')).not.toBeInTheDocument();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('should warn and skip duplicate source registration', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const pluginA = createTestPlugin({
      id: 'src-dup-a',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerSource({
          id: 'shared-source',
          label: 'First',
          onSelect: () => {},
        });
      },
    });

    const pluginB = createTestPlugin({
      id: 'src-dup-b',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerSource({
          id: 'shared-source',
          label: 'Second',
          onSelect: () => {},
        });
      },
    });

    const { config } = await renderUploader([pluginA, pluginB]);
    addSource(config, 'shared-source');

    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"shared-source"'));
    });

    await openModal();
    // Only the first registration should appear
    await expect.element(page.getByText('First')).toBeVisible();
    await expect.element(page.getByText('Second')).not.toBeInTheDocument();

    warnSpy.mockRestore();
  });

  it('should not render plugin source if not present in sourceList', async () => {
    const plugin = createTestPlugin({
      id: 'src-negative',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerSource({
          id: 'unlisted-source',
          label: 'Unlisted Source',
          onSelect: () => {},
        });
      },
    });

    await renderUploader([plugin]);

    await openModal();
    await expect.element(page.getByText('Unlisted Source')).not.toBeInTheDocument();
  });

  it('should render expanded sources with distinct labels', async () => {
    const plugin = createTestPlugin({
      id: 'expandable-plugin',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerSource({
          id: 'parent-source',
          label: 'Parent',
          expand: () => ['child-photo', 'child-video'],
          onSelect: () => {},
        });

        pluginApi.registry.registerSource({
          id: 'child-photo',
          label: 'Photo',
          onSelect: () => {},
        });

        pluginApi.registry.registerSource({
          id: 'child-video',
          label: 'Video',
          onSelect: () => {},
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    addSource(config, 'parent-source');

    await openModal();

    await expect.element(page.getByText('Photo')).toBeVisible();
    await expect.element(page.getByText('Video')).toBeVisible();
    await expect.element(page.getByText('Parent')).not.toBeInTheDocument();
  });

  it('should call correct onSelect for each expanded source', async () => {
    const onSelectPhoto = vi.fn();
    const onSelectVideo = vi.fn();

    const plugin = createTestPlugin({
      id: 'expand-click-plugin',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerSource({
          id: 'camera-like',
          label: 'Camera',
          expand: () => ['photo-mode', 'video-mode'],
          onSelect: () => {},
        });

        pluginApi.registry.registerSource({
          id: 'photo-mode',
          label: 'Take Photo',
          onSelect: onSelectPhoto,
        });

        pluginApi.registry.registerSource({
          id: 'video-mode',
          label: 'Record Video',
          onSelect: onSelectVideo,
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    addSource(config, 'camera-like');

    await openModal();

    await page.getByText('Take Photo').click();
    await vi.waitFor(() => {
      expect(onSelectPhoto).toHaveBeenCalledOnce();
    });
    expect(onSelectVideo).not.toHaveBeenCalled();
  });

  it('should render parent source when expand returns its own id', async () => {
    const plugin = createTestPlugin({
      id: 'no-expand-plugin',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerSource({
          id: 'desktop-camera',
          label: 'Desktop Camera',
          expand: () => ['desktop-camera'],
          onSelect: () => {},
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    addSource(config, 'desktop-camera');

    await openModal();
    await expect.element(page.getByText('Desktop Camera')).toBeVisible();
  });

  it('should not render expanded sources that are not registered', async () => {
    const plugin = createTestPlugin({
      id: 'missing-expand-plugin',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerSource({
          id: 'partial-expand',
          label: 'Partial',
          expand: () => ['registered-child', 'unregistered-child'],
          onSelect: () => {},
        });

        pluginApi.registry.registerSource({
          id: 'registered-child',
          label: 'Registered Child',
          onSelect: () => {},
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    addSource(config, 'partial-expand');

    await openModal();
    await expect.element(page.getByText('Registered Child')).toBeVisible();
    await expect.element(page.getByText('Partial')).not.toBeInTheDocument();
  });
});
