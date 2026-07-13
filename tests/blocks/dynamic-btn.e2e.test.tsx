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

    // Pin the branch precondition: the collection must actually be in the
    // uploading state before clicking, or this could silently exercise the
    // failed/finished branches instead.
    await expect.poll(() => api.getOutputCollectionState().status).toBe('uploading');

    const abortBtn = dynamicBtn.getByLabelText('Remove');
    await expect.element(abortBtn).toBeVisible();
    // Still mid-flight: the upload has not resolved yet.
    expect(api.getOutputCollectionState().successCount).toBe(0);

    await abortBtn.click();

    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(0);
    // The aborted upload must never resolve as a success afterwards.
    expect(api.getOutputCollectionState().successCount).toBe(0);
  }, 30_000);

  it('clears only the failed entry when the abort action is clicked over a mixed failed/uploading collection', async () => {
    const { dynamicBtn, api } = renderDynamicBtn();
    const config = page.getByTestId('uc-config').query()! as Config;
    // Only the entry named 'bad.jpg' is destined to fail — the valid entry
    // added alongside it must survive `_clearAllFailedEntries` untouched.
    config.fileValidators = [(entry) => (entry.name === 'bad.jpg' ? { message: 'Bad file' } : undefined)];

    await expect.element(dynamicBtn).toBeVisible();

    const badFile = new File(['(⌐□_□)'], 'bad.jpg', { type: 'image/jpeg' });
    api.addFileFromObject(badFile);

    // Validation runs asynchronously (`ValidationController`'s debounced
    // queue) — let the bad entry actually fail *before* adding the valid one
    // and calling `uploadAll()`, or `uploadAll()` (which only skips entries
    // that already carry errors) could race the validator and upload it too.
    await expect.poll(() => api.getOutputCollectionState().failedCount, { timeout: 10_000 }).toBe(1);

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.uploadAll();

    // `buildOutputCollectionState`'s status resolves `isFailed` before
    // `isUploading` (see `src/abstract/buildOutputCollectionState.ts`), so the
    // collection reaches 'failed' even while the valid entry is still
    // mid-upload — pinning that `_handleRemove`'s switch takes the 'failed'
    // branch (`_clearAllFailedEntries`), not the 'uploading' one, in a mix.
    await expect.poll(() => api.getOutputCollectionState().status, { timeout: 10_000 }).toBe('failed');
    expect(api.getOutputCollectionState().failedCount).toBe(1);
    expect(api.getOutputCollectionState().totalCount).toBe(2);

    const abortBtn = dynamicBtn.getByLabelText('Remove');
    await expect.element(abortBtn).toBeVisible();
    // `_handleRemove`'s branch is keyed off DynamicBtn's own throttled
    // `_status` (not the raw collection state polled above), so wait for the
    // button's `uc-failed` class — its render is driven by that same
    // `_status` — before clicking, or a race could still catch the button in
    // an earlier ('uploading'/'idle') branch and abort/clear everything.
    await expect.poll(() => abortBtn.element().classList.contains('uc-failed'), { timeout: 10_000 }).toBe(true);
    await abortBtn.click();

    await expect.poll(() => api.getOutputCollectionState().failedCount, { timeout: 10_000 }).toBe(0);
    // The valid, still in-flight entry must not be swept up by the clear.
    expect(api.getOutputCollectionState().totalCount).toBe(1);
    expect(api.getOutputCollectionState().allEntries[0]?.externalUrl).toBe(TEST_IMAGE_URL);
  }, 30_000);

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
