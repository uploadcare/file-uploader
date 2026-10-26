import { describe, expect, it } from 'vitest';
import { plainText } from '@/abstract/l10n';
import type { PluginApi } from '@/abstract/managers/plugin/PluginTypes';
import { defineLocale } from '@/index';
import { TEST_IMAGE_URL } from '~/tests/utils/constants';
import { addSource, createTestPlugin, openModal, renderSolution, within } from '~/tests/utils/render-solution';

declare module '@/abstract/localeRegistry' {
  interface CustomLocaleDefinition {
    'my-source-label': string;
    'lazy-source-label': string;
  }
}

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
          label: plainText('Icon Action'),
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
    // One visible `de` string, so the test can see the switch has been applied.
    defineLocale('de', { 'locale-id': 'de', 'start-from-cancel': 'Abbrechen' } as never);

    let lazyRegistry: PluginApi['registry'] | undefined;
    const plugin = createTestPlugin({
      id: 'lazy-l10n',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerL10n({ en: { 'lazy-source-label': 'Generate' } });
        pluginApi.registry.registerSource({
          id: 'lazy-source',
          label: 'lazy-source-label',
          onSelect: () => {},
        });
        lazyRegistry = pluginApi.registry;
      },
    });

    const { config, root } = await renderSolution('regular', { plugins: [plugin] });
    addSource(config, 'lazy-source');

    await openModal(root);
    await expect.element(within(root).getByText('Generate')).toBeVisible();

    config.localeName = 'de';
    await expect.element(within(root).getByText('Abbrechen')).toBeVisible();
    // Registered only now, after the LocaleManager has applied plugin locales for the switch (as a plugin awaiting a
    // dynamic locale import would). This reaches the rendered label only if `registerL10n` notifies subscribers.
    lazyRegistry?.registerL10n({ de: { 'lazy-source-label': 'Erzeugen' } });

    await expect.element(within(root).getByText('Erzeugen')).toBeVisible();
  });

  it('restores the built-in string once the plugin is unregistered', async () => {
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
    await expect.element(within(root).getByText('Translated Upload')).not.toBeInTheDocument();
    await expect.element(within(root).getByText('Upload files')).toBeVisible();
  });

  it("keeps a plugin's translation of a built-in string across locale switches", async () => {
    defineLocale('de', { 'upload-files': 'Dateien hochladen' } as never);
    const plugin = createTestPlugin({
      id: 'l10n-builtin',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerL10n({
          en: { 'upload-files': 'Plugin upload' },
          de: { 'upload-files': 'Plugin hochladen' },
        });
      },
    });

    const { config, api, root } = await renderSolution('regular', { plugins: [plugin] });
    api.setModalState(true);
    await expect.element(within(root).getByText('Plugin upload')).toBeVisible();

    config.localeName = 'de';
    await expect.element(within(root).getByText('Plugin hochladen')).toBeVisible();

    config.localeName = 'en';
    await expect.element(within(root).getByText('Plugin upload')).toBeVisible();
  });

  it('lets localeDefinitionOverride win over a plugin translation', async () => {
    const plugin = createTestPlugin({
      id: 'l10n-overridden',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerL10n({ en: { 'upload-files': 'Plugin upload' } });
      },
    });

    const { api, root } = await renderSolution('regular', {
      plugins: [plugin],
      localeDefinitionOverride: { en: { 'upload-files': 'My upload' } },
    });
    api.setModalState(true);

    await expect.element(within(root).getByText('My upload')).toBeVisible();
    await expect.element(within(root).getByText('Plugin upload')).not.toBeInTheDocument();
  });
});
