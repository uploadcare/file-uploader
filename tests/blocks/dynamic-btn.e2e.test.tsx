import { beforeAll, describe, expect, it } from 'vitest';
import { commands, page } from 'vitest/browser';
import type { Config, UploadCtxProvider } from '@/index.js';
import { TEST_IMAGE_URL } from '../utils/constants';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

/**
 * M9h Task 1 — gap-fill ahead of the ChildBlock port of DynamicBtn.
 *
 * `tests/dynamic-btn-upload-list.e2e.test.tsx` deeply pins DynamicBtn's
 * navigation behavior (upload list open/closed across confirmUpload and
 * compact-mode branches) but never exercises `DynamicBtn#_handleRemove` —
 * the three-way `switch (this._status)` that the abort/remove action
 * (`uc-file-action-button`'s `@uc:remove`) dispatches into:
 *   - 'uploading' -> `_abortAllEntries()` (aborts in-flight uploads)
 *   - 'failed'    -> `_clearAllFailedEntries()` (clears only failed entries)
 *   - default     -> `_clearAllEntries()` (clears everything, e.g. on success)
 * None of these branches has any existing pin. A ChildBlock rewrite of this
 * switch (or of `shouldShowAbortAction`) could silently break any of them.
 */
describe('DynamicBtn remove/abort action', () => {
  const renderDynamicBtn = () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular dynamic-button ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
    const dynamicBtn = page.getByTestId('uc-dynamic-btn');
    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();
    return { dynamicBtn, api };
  };

  it('aborts in-flight uploads when the abort action is clicked while uploading', async () => {
    const { dynamicBtn, api } = renderDynamicBtn();
    await expect.element(dynamicBtn).toBeVisible();

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.uploadAll();

    const abortBtn = dynamicBtn.getByLabelText('Remove');
    await expect.element(abortBtn).toBeVisible();
    // Still mid-flight: the upload has not resolved yet.
    expect(api.getOutputCollectionState().successCount).toBe(0);

    await abortBtn.click();

    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(0);
    // The aborted upload must never resolve as a success afterwards.
    expect(api.getOutputCollectionState().successCount).toBe(0);
  }, 30_000);

  it('clears only failed entries when the abort action is clicked in the failed state', async () => {
    const { dynamicBtn, api } = renderDynamicBtn();
    const config = page.getByTestId('uc-config').query()! as Config;
    config.fileValidators = [() => ({ message: 'Bad file' })];

    await expect.element(dynamicBtn).toBeVisible();

    // Go through the file chooser (not `api.initFlow()`, which navigates
    // straight to the upload-list modal once the collection is non-empty)
    // so DynamicBtn's own `onFileAdd` hook stays in control and the modal
    // never opens over the abort button — matching the non-confirm flow
    // already pinned in tests/dynamic-btn-upload-list.e2e.test.tsx.
    commands.waitFileChooserAndUpload(['../fixtures/test_image.jpeg']);
    await dynamicBtn.click();

    await expect.poll(() => api.getOutputCollectionState().status).toBe('failed');

    const abortBtn = dynamicBtn.getByLabelText('Remove');
    await expect.element(abortBtn).toBeVisible();
    await abortBtn.click();

    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(0);
  });

  it('clears all entries when the remove action is clicked after a successful upload', async () => {
    const { dynamicBtn, api } = renderDynamicBtn();
    await expect.element(dynamicBtn).toBeVisible();

    commands.waitFileChooserAndUpload(['../fixtures/test_image.jpeg']);
    await dynamicBtn.click();

    await expect.element(dynamicBtn.getByText('1 file uploaded')).toBeVisible();
    await expect.poll(() => api.getOutputCollectionState().successCount).toBe(1);

    const removeBtn = dynamicBtn.getByLabelText('Remove');
    await expect.element(removeBtn).toBeVisible();
    await removeBtn.click();

    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(0);
  });
});
