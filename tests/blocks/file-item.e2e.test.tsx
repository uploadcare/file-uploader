import { beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, FileItem, OutputFileEntry, UploadCtxProvider, UploaderPlugin } from '@/index.ts';
import type { Uid } from '../../src/lit/Uid';
import { TEST_IMAGE_URL } from '../utils/constants';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

// M9e Task 2 — additive parity e2e pinning current v1 `uc-file-item` behavior
// ahead of the FileItem/Thumb family port. Mounts the full regular solution +
// `<uc-upload-ctx-provider>` (same composition as tests/blocks/upload-events-wiring.e2e.test.tsx),
// drives real uploads through the public api, and asserts only against the
// rendered DOM / documented api surface.
const TEST_IMAGE_NAME = 'prithiviraj-a-fa7Stge3YXs-unsplash.jpg';

const renderFileItemHost = (plugins: UploaderPlugin[] = []) => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );
  const config = page.getByTestId('uc-config').query()! as Config;
  config.plugins = plugins;
  const provider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
  return { ctxName, config, api: provider.api };
};

const fileItemEl = () => document.querySelector('uc-file-item') as FileItem | null;

// Standalone-block composition (same shape as tests/blocks/thumb.e2e.test.tsx)
// for the uploader-scope-free regression case, which needs no upload
// collection / uploader block at all.
const renderStandaloneFileItem = () => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-file-item ctx-name={ctxName}></uc-file-item>
      <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
  const fileItem = document.querySelector('uc-file-item')! as FileItem;
  return { ctxName, fileItem };
};

describe('uc-file-item (parity, real upload flow)', () => {
  it('renders with the file name visible in list mode and a "mode" attribute reflecting the view mode', async () => {
    const { api } = renderFileItemHost();
    api.addFileFromUrl(TEST_IMAGE_URL);
    // `onFileAdd` only auto-navigates to `upload-list` once an upload actually
    // starts; adding via the api alone leaves the modal closed, so the item
    // exists in the DOM but is not visible/rendered (its IntersectionObserver
    // never reports intersecting while the dialog is closed). `initFlow()` is
    // the same call the "Upload files" button issues to open the modal.
    api.initFlow();

    await expect.element(page.getByTestId('uc-file-item')).toBeVisible();
    await expect.element(page.getByText(TEST_IMAGE_NAME)).toBeVisible();
    // `filesViewMode` defaults to `'list'` (src/blocks/Config/initialConfig.ts).
    await expect.poll(() => fileItemEl()?.getAttribute('mode')).toBe('list');
  });

  it('shows the badge-success icon and marks .uc-inner data-finished on upload success', async () => {
    const { api } = renderFileItemHost();
    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();
    api.uploadAll();

    await expect.poll(() => api.getOutputCollectionState().successCount, { timeout: 20_000 }).toBe(1);

    await expect
      .poll(() => document.querySelector('uc-file-item uc-thumb uc-icon[name="badge-success"]'), { timeout: 20_000 })
      .toBeTruthy();
    await expect
      .poll(() => document.querySelector('uc-file-item .uc-inner')?.hasAttribute('data-finished'), { timeout: 20_000 })
      .toBe(true);
  }, 30_000);

  it('removes the entry when the remove action is clicked: totalCount drops to 0 and the item unmounts', async () => {
    const { api } = renderFileItemHost();
    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();
    api.uploadAll();

    await expect.poll(() => api.getOutputCollectionState().successCount, { timeout: 20_000 }).toBe(1);
    await expect.element(page.getByTestId('uc-file-item')).toBeVisible();

    const removeBtn = page.getByRole('button', { name: 'Remove', exact: true });
    await expect.element(removeBtn).toBeVisible();
    await removeBtn.click();

    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(0);
    await expect.poll(() => fileItemEl()).toBeNull();
  }, 30_000);

  it('hides the file name in grid mode by default, and shows it when gridShowFileNames is true', async () => {
    const { config, api } = renderFileItemHost();
    config.filesViewMode = 'grid';
    config.gridShowFileNames = false;
    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    await expect.element(page.getByTestId('uc-file-item')).toBeVisible();
    await expect.poll(() => fileItemEl()?.getAttribute('mode')).toBe('grid');
    await expect.poll(() => document.querySelector('uc-file-item .uc-file-name')?.hasAttribute('hidden')).toBe(true);

    config.gridShowFileNames = true;
    await expect.poll(() => document.querySelector('uc-file-item .uc-file-name')?.hasAttribute('hidden')).toBe(false);
    await expect.element(page.getByText(TEST_IMAGE_NAME)).toBeVisible();
  });

  it('renders a plugin-registered file action and passes the output entry to onClick', async () => {
    const onClick = vi.fn<(entry: OutputFileEntry) => void>();
    const plugin: UploaderPlugin = {
      id: 'fa-file-item-parity',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerFileAction({
          id: 'file-item-parity-action',
          icon: 'default',
          label: 'Parity Action',
          shouldRender: () => true,
          onClick,
        });
      },
    };

    const { api } = renderFileItemHost([plugin]);
    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    const actionBtnSelector = 'uc-file-item [data-plugin-action-id="file-item-parity-action"]';
    await expect.poll(() => document.querySelector(actionBtnSelector), { timeout: 20_000 }).toBeTruthy();

    (document.querySelector(actionBtnSelector) as HTMLButtonElement).click();

    await vi.waitFor(() => {
      expect(onClick).toHaveBeenCalledOnce();
      const entry = onClick.mock.calls[0][0];
      expect(entry).toHaveProperty('internalId');
      expect(entry).toHaveProperty('status');
    });
  }, 30_000);

  // M9e regression — `*pluginManager` is registered by any LitBlock, so
  // `bag.when('pluginManager', ...)` fires synchronously during
  // `controllerReady`, driving `_updatePluginFileActions()` →
  // `this.bag.api.getOutputItem(this.uid)`. `*publicApi` is uploader-scope-only
  // (registered by an uploader block), so a `<uc-file-item>` rendered outside
  // that scope (e.g. alongside a bare `<uc-config>`, no uploader block) must
  // fall back gracefully instead of throwing an unhandled error from the
  // required-getter read.
  it('renders without unhandled errors when given a uid outside an uploader scope', async () => {
    const errors: string[] = [];
    const onError = (event: ErrorEvent) => {
      errors.push(String(event.error?.message ?? event.message));
      event.preventDefault();
    };
    window.addEventListener('error', onError);

    try {
      const { fileItem } = renderStandaloneFileItem();
      // Let the IntersectionObserver-gated render open before assigning `uid` —
      // a uid write while the gate is still closed doesn't surface in the next
      // `willUpdate`'s changedProperties (see ChildBlock's render-gate note).
      await new Promise((resolve) => setTimeout(resolve, 100));
      fileItem.uid = 'some-uid' as Uid;

      await fileItem.updateComplete;
      // Give any async/microtask-scheduled throw a moment to surface as an
      // unhandled window error before asserting.
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(fileItem.isConnected).toBe(true);
    } finally {
      window.removeEventListener('error', onError);
    }

    expect(errors).toEqual([]);
  });
});
