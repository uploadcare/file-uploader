import { describe, expect, it, vi } from 'vitest';
import { instagramPlugin } from '@/plugins/instagramPlugin';
import { addSource, createTestPlugin, openModal, renderSolution, within } from '~/tests/utils/render-solution';

describe('plugin sources', () => {
  it('shows a registered source in the source list', async () => {
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

    const { config, root } = await renderSolution('regular', { plugins: [plugin] });
    addSource(config, 'my-source');

    await openModal(root);
    await expect.element(within(root).getByText('My Custom Source')).toBeVisible();
  });

  it('calls onSelect when the source is clicked', async () => {
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

    const { config, root } = await renderSolution('regular', { plugins: [plugin] });
    addSource(config, 'click-source');

    await openModal(root);
    await within(root).getByText('Click Me').click();

    await vi.waitFor(() => {
      expect(onSelect).toHaveBeenCalledOnce();
    });
  });

  it('resolves the label through registered l10n', async () => {
    const plugin = createTestPlugin({
      id: 'src-l10n',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerL10n({
          en: {
            'src-type-custom': 'Translated Source',
          },
        });

        pluginApi.registry.registerSource({
          id: 'l10n-source',
          label: 'src-type-custom',
          onSelect: () => {},
        });
      },
    });

    const { config, root } = await renderSolution('regular', { plugins: [plugin] });
    addSource(config, 'l10n-source');

    await openModal(root);
    await expect.element(within(root).getByText('Translated Source')).toBeVisible();
  });

  it('removes the source when the plugin is unregistered', async () => {
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

    const { config, root } = await renderSolution('regular', { plugins: [plugin] });
    addSource(config, 'removable-source');

    await openModal(root);
    await expect.element(within(root).getByText('Removable Source')).toBeVisible();

    config.plugins = [];

    await expect.element(within(root).getByText('Removable Source')).not.toBeInTheDocument();
  });

  it('logs an error and renders no button for the deprecated instagram source', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { config, root } = await renderSolution('regular', { plugins: [instagramPlugin] });
      addSource(config, 'instagram');

      await openModal(root);

      await vi.waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Instagram source was removed'));
      });

      await expect.element(root.querySelector<HTMLElement>('[data-source-id="instagram"]')).not.toBeInTheDocument();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('warns and skips a duplicate source id', async () => {
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

    const { config, root } = await renderSolution('regular', { plugins: [pluginA, pluginB] });
    addSource(config, 'shared-source');

    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"shared-source"'));
    });

    await openModal(root);
    await expect.element(within(root).getByText('First')).toBeVisible();
    await expect.element(within(root).getByText('Second')).not.toBeInTheDocument();

    warnSpy.mockRestore();
  });

  it('hides a registered source that is not in sourceList', async () => {
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

    const { root } = await renderSolution('regular', { plugins: [plugin] });

    await openModal(root);
    await expect.element(within(root).getByText('Unlisted Source')).not.toBeInTheDocument();
  });
});
