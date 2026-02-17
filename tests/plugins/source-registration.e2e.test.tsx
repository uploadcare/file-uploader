import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
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
});
