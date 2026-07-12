import { beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { EventPayload, UploadCtxProvider } from '@/index.js';
import { TEST_IMAGE_URL } from '../utils/constants';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

/**
 * M9b Task 2 — additive e2e pinning the documented upload-event surface
 * (events on `<uc-upload-ctx-provider>` + `api.getOutputCollectionState()`)
 * ahead of moving `UploadEventsController` to a per-ctx shared instance. This
 * suite must pass unchanged before and after that rewiring — only documented
 * surface is asserted, never `*`-key internals.
 */
describe('upload events wiring', () => {
  it('fires file-upload-success and common-upload-success on uploadAll(), with a success-shaped collection state', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = uploadCtxProvider.api;

    const uploadSuccessHandler = vi.fn<(e: CustomEvent<EventPayload['file-upload-success']>) => void>();
    const commonSuccessHandler = vi.fn<(e: CustomEvent<EventPayload['common-upload-success']>) => void>();
    uploadCtxProvider.addEventListener('file-upload-success', uploadSuccessHandler);
    uploadCtxProvider.addEventListener('common-upload-success', commonSuccessHandler);

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.uploadAll();

    const successPayload = await vi.waitFor(
      () => {
        expect(uploadSuccessHandler).toHaveBeenCalled();
        return uploadSuccessHandler.mock.calls[0][0].detail;
      },
      { timeout: 20_000 },
    );
    expect(successPayload).toMatchObject(expect.objectContaining({ status: 'success' }));

    const commonPayload = await vi.waitFor(
      () => {
        expect(commonSuccessHandler).toHaveBeenCalled();
        return commonSuccessHandler.mock.calls[0][0].detail;
      },
      { timeout: 20_000 },
    );
    expect(commonPayload).toMatchObject(expect.objectContaining({ status: 'success', successCount: 1 }));
  }, 30_000);

  it('fires change and reaches successCount 1 in getOutputCollectionState()', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = uploadCtxProvider.api;

    const changeHandler = vi.fn<(e: CustomEvent<EventPayload['change']>) => void>();
    uploadCtxProvider.addEventListener('change', changeHandler);

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.uploadAll();

    await expect.poll(() => changeHandler.mock.calls.length > 0, { timeout: 20_000 }).toBe(true);
    await expect.poll(() => api.getOutputCollectionState().successCount, { timeout: 20_000 }).toBe(1);
  }, 30_000);

  it('shares upload state across two ctx-providers on the same ctx, without doubling counts', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    const firstProvider = page.getByTestId('uc-upload-ctx-provider').nth(0).query()! as UploadCtxProvider;
    const secondProvider = page.getByTestId('uc-upload-ctx-provider').nth(1).query()! as UploadCtxProvider;
    const api = firstProvider.api;

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.uploadAll();

    await expect.poll(() => api.getOutputCollectionState().successCount, { timeout: 20_000 }).toBe(1);
    await expect.poll(() => secondProvider.api.getOutputCollectionState().successCount, { timeout: 20_000 }).toBe(1);

    // A single upload should never be counted twice by either sink.
    expect(firstProvider.api.getOutputCollectionState().totalCount).toBe(1);
    expect(secondProvider.api.getOutputCollectionState().totalCount).toBe(1);
  }, 30_000);

  it('fires file-removed on removeFileByInternalId() and removeAllFiles()', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = uploadCtxProvider.api;

    const removedHandler = vi.fn<(e: CustomEvent<EventPayload['file-removed']>) => void>();
    uploadCtxProvider.addEventListener('file-removed', removedHandler);

    const entry = api.addFileFromUrl(TEST_IMAGE_URL);
    api.removeFileByInternalId(entry.internalId);

    const removedPayload = await vi.waitFor(() => {
      expect(removedHandler).toHaveBeenCalledOnce();
      return removedHandler.mock.calls[0][0].detail;
    });
    expect(removedPayload).toMatchObject(expect.objectContaining({ internalId: entry.internalId, status: 'removed' }));

    // A second file added and cleared via removeAllFiles() also fires file-removed.
    const secondEntry = api.addFileFromUrl(TEST_IMAGE_URL);
    api.removeAllFiles();

    await vi.waitFor(() => {
      expect(removedHandler).toHaveBeenCalledTimes(2);
    });
    const secondRemovedPayload = removedHandler.mock.calls[1][0].detail;
    expect(secondRemovedPayload).toMatchObject(
      expect.objectContaining({ internalId: secondEntry.internalId, status: 'removed' }),
    );
  }, 30_000);
});
