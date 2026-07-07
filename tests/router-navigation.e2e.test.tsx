import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { UploadCtxProvider } from '@/index';
import { TEST_IMAGE_URL } from './utils/constants';
import '../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

const getApi = () => {
  const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
  return ctxProvider.getAPI();
};

// Router-swap (M7) integration behaviors that the DOM-free RouterController unit
// tests can't cover: guard wiring on the real upload list, the traverse()
// back-vs-close intent, the deprecated setCurrentActivity/setModalState pairing,
// and per-preset doneFlow landing.
describe('Router navigation (regular preset)', () => {
  beforeEach(() => {
    const ctxName = `test-${Math.random().toString(36).slice(2)}`;
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
  });

  it('closes the upload list when the last file is removed (empty-list guard)', async () => {
    const api = getApi();
    const uploadList = page.getByTestId('uc-upload-list');

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow(); // files present → upload list
    await expect.element(uploadList).toBeVisible();

    api.removeAllFiles();

    // The upload-list guard (showEmptyList=false) no longer holds, so revalidate
    // leaves it instead of stranding the user on an empty list.
    await expect.element(uploadList).not.toBeVisible();
  });

  it('returns to the upload list when start-from is cancelled over it (back, not close)', async () => {
    const api = getApi();
    const uploadList = page.getByTestId('uc-upload-list');
    const startFrom = page.getByTestId('uc-start-from');

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();
    await expect.element(uploadList).toBeVisible();

    // "Add more" opens start-from over the populated list.
    await uploadList.getByRole('button', { name: 'Add more' }).click();
    await expect.element(startFrom).toBeVisible();
    await expect.element(uploadList).not.toBeVisible();

    // Cancel should traverse back to the list, not tear everything down.
    await startFrom.getByText('Cancel', { exact: true }).click();
    await expect.element(uploadList).toBeVisible();
    await expect.element(startFrom).not.toBeVisible();
  });

  it('setCurrentActivity + setModalState(true) opens, then swaps to a new activity', async () => {
    const api = getApi();
    const startFrom = page.getByTestId('uc-start-from');
    const uploadList = page.getByTestId('uc-upload-list');

    // A file present keeps the upload-list guard satisfied; adding via the API
    // does not itself open any modal.
    api.addFileFromUrl(TEST_IMAGE_URL);

    // The deprecated v1 pairing: set the background activity, then open its modal.
    api.setCurrentActivity('start-from');
    api.setModalState(true);
    await expect.element(startFrom).toBeVisible();

    // Re-pairing with a different activity must swap the modal, not no-op on the
    // now-stale open modal (setModalState opens the background slot, not the
    // effective current activity, which would still be the open start-from).
    api.setCurrentActivity('upload-list');
    api.setModalState(true);
    await expect.element(uploadList).toBeVisible();
    await expect.element(startFrom).not.toBeVisible();

    // setModalState(false) closes everything.
    api.setModalState(false);
    await expect.element(uploadList).not.toBeVisible();
  });

  it('doneFlow closes everything when the preset has no done activity', async () => {
    const api = getApi();
    const uploadList = page.getByTestId('uc-upload-list');

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();
    await expect.element(uploadList).toBeVisible();

    api.doneFlow(); // regular preset configures no doneActivity → close
    await expect.element(uploadList).not.toBeVisible();
  });
});

describe('Router navigation (inline preset)', () => {
  beforeEach(() => {
    const ctxName = `test-${Math.random().toString(36).slice(2)}`;
    page.render(
      <>
        <uc-file-uploader-inline ctx-name={ctxName}></uc-file-uploader-inline>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
  });

  it('doneFlow lands on the configured done activity (start-from)', async () => {
    const api = getApi();
    const uploadList = page.getByTestId('uc-upload-list');
    const startFrom = page.getByTestId('uc-start-from');

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow(); // files present → upload list (inline, background slot)
    await expect.element(uploadList).toBeVisible();

    api.doneFlow(); // inline preset configures doneActivity: start-from
    await expect.element(startFrom).toBeVisible();
    await expect.element(uploadList).not.toBeVisible();
  });
});
