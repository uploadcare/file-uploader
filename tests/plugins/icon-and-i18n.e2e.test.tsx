import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { addSource, createTestPlugin, getApi, openModal, renderUploader, TEST_IMAGE_URL } from './utils';

describe('Icon Registration', () => {
  it('should make registered icon available for use in file actions', async () => {
    const plugin = createTestPlugin({
      id: 'icon-plugin',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerIcon({
          name: 'my-custom-icon',
          svg: '<svg viewBox="0 0 24 24"><rect width="24" height="24"/></svg>',
        });
        pluginApi.registry.registerFileAction({
          id: 'icon-action',
          icon: 'my-custom-icon',
          shouldRender: () => true,
          onClick: () => {},
        });
      },
    });

    await renderUploader([plugin]);
    const api = getApi();

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    // The file action button with the custom icon should be visible
    await expect.element(page.getByRole('button', { name: 'icon-action' })).toBeVisible();
  });
});

describe('I18n Registration', () => {
  it('should use registered label translations for source list items', async () => {
    const plugin = createTestPlugin({
      id: 'i18n-plugin',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerI18n({
          en: {
            'my-source-label': 'My Translated Source',
          },
        });

        pluginApi.registry.registerSource({
          id: 'translated-source',
          label: 'my-source-label',
          onSelect: () => {},
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    addSource(config, 'translated-source');

    await openModal();
    await expect.element(page.getByText('My Translated Source')).toBeVisible();
  });

  it('should keep plugin i18n overrides even after plugin is unregistered (current behavior)', async () => {
    const plugin = createTestPlugin({
      id: 'i18n-persist',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerI18n({
          en: {
            'upload-files': 'Translated Upload',
          },
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    const api = getApi();

    api.setModalState(true);
    await expect.element(page.getByText('Translated Upload')).toBeVisible();

    config.plugins = [];

    api.setModalState(true);
    await expect.element(page.getByText('Translated Upload')).toBeVisible();
  });
});
