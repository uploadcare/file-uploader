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

  it('stops dispatching DOM events on a ctx-provider once it disconnects, while a sibling on the same ctx keeps receiving them', async () => {
    // M9n Task 1 — gap-fill ahead of the ctx-creation-seam move. Pins
    // `EventBridgeController.hostDisconnected` (src/lit/EventBridgeController.ts):
    // once a `<uc-upload-ctx-provider>` disconnects, it must stop re-dispatching
    // the per-ctx `EventBus` as DOM CustomEvents on itself — the bus keeps
    // running (a sibling provider on the same ctx still gets every event).
    // Nothing in the existing suite disconnects the ctx-provider element
    // itself and observes the bridge stop; the "owner-candidate removal" test
    // above only removes an unrelated block.
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    const survivingProvider = page.getByTestId('uc-upload-ctx-provider').nth(0).query()! as UploadCtxProvider;
    const disconnectingProvider = page.getByTestId('uc-upload-ctx-provider').nth(1).query()! as UploadCtxProvider;
    const api = survivingProvider.api;

    const survivingHandler = vi.fn<(e: CustomEvent<EventPayload['file-added']>) => void>();
    const disconnectingHandler = vi.fn<(e: CustomEvent<EventPayload['file-added']>) => void>();
    survivingProvider.addEventListener('file-added', survivingHandler);
    disconnectingProvider.addEventListener('file-added', disconnectingHandler);

    api.addFileFromUrl(TEST_IMAGE_URL);

    // Both providers bridge the same ctx's EventBus before either disconnects.
    await vi.waitFor(() => {
      expect(survivingHandler).toHaveBeenCalledOnce();
      expect(disconnectingHandler).toHaveBeenCalledOnce();
    });

    disconnectingProvider.remove();

    api.addFileFromUrl(TEST_IMAGE_URL);

    // Waiting on the surviving provider's second call proves the ctx's event
    // bus has ticked past the point where the removed provider would have
    // re-dispatched too, had its bridge not unsubscribed on disconnect.
    await vi.waitFor(() => {
      expect(survivingHandler).toHaveBeenCalledTimes(2);
    });
    expect(disconnectingHandler).toHaveBeenCalledOnce();
  }, 30_000);

  it('keeps deriving upload events after an owner-candidate block is removed', async () => {
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

    const commonSuccessHandler = vi.fn<(e: CustomEvent<EventPayload['common-upload-success']>) => void>();
    uploadCtxProvider.addEventListener('common-upload-success', commonSuccessHandler);

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.uploadAll();

    await expect.poll(() => api.getOutputCollectionState().successCount, { timeout: 20_000 }).toBe(1);
    await expect.poll(() => commonSuccessHandler.mock.calls.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
    const callsBeforeRemoval = commonSuccessHandler.mock.calls.length;

    // Remove the internal `uc-simple-btn` — under v1 semantics this was the
    // ctx-owner candidate rendered by the solution first, and its removal
    // could pause event derivation. Under M9b, `*uploadEvents` is a per-ctx
    // shared instance independent of any single block's lifecycle.
    document.querySelector('uc-simple-btn')?.remove();

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.uploadAll();

    // Proves event derivation kept running after the owner-candidate's removal:
    // a second `common-upload-success` fires and successCount reaches 2.
    await expect
      .poll(() => commonSuccessHandler.mock.calls.length, { timeout: 20_000 })
      .toBeGreaterThan(callsBeforeRemoval);
    await expect.poll(() => api.getOutputCollectionState().successCount, { timeout: 20_000 }).toBe(2);
  }, 30_000);
});
