import { describe, expect, it } from 'vitest';
import { defineLocale } from '@/index';
import { delay } from '@/utils/delay';
import { TEST_IMAGE_URL } from '~/tests/utils/constants';
import { addSource, createTestPlugin, openModal, renderSolution, within } from '~/tests/utils/render-solution';

describe('plugin icons', () => {
  it('makes a registered icon usable by file actions', async () => {
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

    const { api, root } = await renderSolution('regular', { plugins: [plugin] });

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    // The file action button with the custom icon should be visible
    await expect.element(within(root).getByRole('button', { name: 'Icon Action' })).toBeVisible();
  });
});

describe('plugin l10n', () => {
  it('translates source labels through registered l10n', async () => {
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

    const { config, root } = await renderSolution('regular', { plugins: [plugin] });
    addSource(config, 'translated-source');

    await openModal(root);
    await expect.element(within(root).getByText('My Translated Source')).toBeVisible();
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

    const { config, root } = await renderSolution('regular', { plugins: [plugin] });
    addSource(config, 'lazy-source');

    await openModal(root);
    await expect.element(within(root).getByText('Generate')).toBeVisible();

    config.localeName = 'de';
    await expect.element(within(root).getByText('Erzeugen')).toBeVisible();
  });

  it('keeps plugin l10n overrides after the plugin is unregistered', async () => {
    // QUIRK(plugins): `LocaleManager._applyPluginLocales` (src/abstract/managers/LocaleManager.ts:69) writes plugin
    // strings into the ctx `*l10n/<key>` slots and nothing resets them when `registry.purge()` drops the plugin's l10n.
    // Pinned as current behaviour, not endorsed.
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

    const { config, api, root } = await renderSolution('regular', { plugins: [plugin] });

    api.setModalState(true);
    await expect.element(within(root).getByText('Translated Upload')).toBeVisible();

    config.plugins = [];

    api.setModalState(true);
    await expect.element(within(root).getByText('Translated Upload')).toBeVisible();
  });
});
