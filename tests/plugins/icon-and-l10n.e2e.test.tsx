import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { defineLocale } from '@/index';
import { delay } from '@/utils/delay';
import { TEST_IMAGE_URL } from '../utils/constants';
import { addSource, createTestPlugin, getApi, openModal, renderUploader } from './utils';

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
          label: 'Icon Action',
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
    await expect.element(page.getByRole('button', { name: 'Icon Action' })).toBeVisible();
  });
});

describe('L10n Registration', () => {
  it('should use registered label translations for source list items', async () => {
    const plugin = createTestPlugin({
      id: 'l10n-plugin',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerL10n({
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

  it('applies l10n registered asynchronously after a locale switch to a rendered source label', async () => {
    // The uploader needs a `de` definition so the locale switch resolves cleanly.
    defineLocale('de', {} as never);

    const plugin = createTestPlugin({
      id: 'lazy-l10n',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerL10n({ en: { 'lazy-source-label': 'Generate' } });
        pluginApi.registry.registerSource({
          id: 'lazy-source',
          label: 'lazy-source-label',
          onSelect: () => {},
        });
        // Register the locale's strings lazily — AFTER the LocaleManager has
        // already applied plugin locales for the switch (mimics a real plugin
        // awaiting a dynamic locale import). This only reaches the rendered
        // label if `registerL10n` notifies subscribers.
        pluginApi.config.subscribe('localeName', (name) => {
          if (name === 'de') {
            void delay(0).then(() => {
              pluginApi.registry.registerL10n({ de: { 'lazy-source-label': 'Erzeugen' } });
            });
          }
        });
      },
    });

    const { config } = await renderUploader([plugin]);
    addSource(config, 'lazy-source');

    await openModal();
    await expect.element(page.getByText('Generate')).toBeVisible();

    config.localeName = 'de';
    await expect.element(page.getByText('Erzeugen')).toBeVisible();
  });

  it('should keep plugin l10n overrides even after plugin is unregistered (current behavior)', async () => {
    const plugin = createTestPlugin({
      id: 'l10n-persist',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerL10n({
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
