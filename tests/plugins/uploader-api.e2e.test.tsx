import { describe, expect, it } from 'vitest';
import type { PluginSetupParams } from '@/index';
import { testFile } from '~/tests/fixtures/files';
import { addSource, createTestPlugin, openModal, renderSolution, within } from '~/tests/utils/render-solution';

describe('uploaderApi (from plugin)', () => {
  it('hands setup() the same api object the provider exposes', async () => {
    let received: PluginSetupParams['uploaderApi'] | undefined;
    const plugin = createTestPlugin({
      id: 'uapi-identity',
      setup: ({ uploaderApi }) => {
        received = uploaderApi;
      },
    });

    const { api } = await renderSolution('regular', { plugins: [plugin] });

    await expect.poll(() => received).toBe(api);
  });

  it('adds a file and switches activity from a source onSelect', async () => {
    const plugin = createTestPlugin({
      id: 'uapi-roundtrip',
      setup: ({ pluginApi, uploaderApi }) => {
        pluginApi.registry.registerSource({
          id: 'obj-add-source',
          label: 'Add Object',
          onSelect: () => {
            uploaderApi.addFileFromObject(testFile('test-file.txt', 'text/plain'));
            uploaderApi.setCurrentActivity('upload-list');
            // Selecting a source closes the modal, so reopen it on the list.
            uploaderApi.setModalState(true);
          },
        });
      },
    });

    const { config, root } = await renderSolution('regular', { plugins: [plugin] });
    addSource(config, 'obj-add-source');

    await openModal(root);
    await within(root).getByText('Add Object').click();

    await expect.element(within(root).getByText('test-file.txt')).toBeVisible();
  });
});
