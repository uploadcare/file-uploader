import { uploadFile } from '@uploadcare/upload-client';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, EventPayload } from '@/index.js';
import { IMAGE } from './fixtures/files';
import { TEST_IMAGE_URL } from './utils/constants';
import '../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

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

describe('API', () => {
  // M9n Task 1 — gap-fill ahead of the ctx-creation-seam move (map creation +
  // upload-state seeds move controller-side). Pins the documented idle
  // default shape `getOutputCollectionState()` returns on a fresh
  // composition, before any file is added — i.e. the seeded
  // `*commonProgress`/`*collectionErrors`/`*groupInfo`/`*uploadList` values
  // from `uploaderBlockCtx` (src/abstract/CTX.ts), read via the plain
  // getters in `buildOutputCollectionState`. Nothing in the existing suite
  // asserts this pre-upload shape — every other `getOutputCollectionState()`
  // read happens after at least one `addFile*` call.
  it('getOutputCollectionState() returns the idle default shape on a fresh composition, before any upload activity', () => {
    const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = uploadCtxProvider.api;

    const state = api.getOutputCollectionState();

    expect(state).toMatchObject({
      status: 'idle',
      totalCount: 0,
      successCount: 0,
      failedCount: 0,
      uploadingCount: 0,
      progress: 0,
      errors: [],
      group: null,
      isFailed: false,
      isUploading: false,
      isSuccess: false,
      allEntries: [],
      successEntries: [],
      failedEntries: [],
      uploadingEntries: [],
      idleEntries: [],
    });
  });

  it('should emit events', async () => {
    const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = uploadCtxProvider.api;

    const eventHandler = vi.fn<(e: CustomEvent<EventPayload['file-added']>) => void>();

    uploadCtxProvider.addEventListener('file-added', eventHandler);

    const url = TEST_IMAGE_URL;
    api.addFileFromUrl(url);

    const eventPayload = await vi.waitFor(() => {
      expect(eventHandler).toHaveBeenCalled();
      return eventHandler.mock.calls[0][0].detail;
    });

    expect(eventPayload).toMatchObject(expect.objectContaining({ status: 'idle', externalUrl: url }));
  });

  it('should add an already-uploaded file from an UploadcareFile instance and fire the success events without uploading', async () => {
    // Upload a real local image via the upload client to get a genuine UploadcareFile.
    const file = await uploadFile(IMAGE.PIXEL, { publicKey: 'demopublickey', store: false });

    const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = uploadCtxProvider.api;

    const fileAddedHandler = vi.fn<(e: CustomEvent<EventPayload['file-added']>) => void>();
    const uploadStartHandler = vi.fn<(e: CustomEvent<EventPayload['file-upload-start']>) => void>();
    const uploadSuccessHandler = vi.fn<(e: CustomEvent<EventPayload['file-upload-success']>) => void>();
    const commonSuccessHandler = vi.fn<(e: CustomEvent<EventPayload['common-upload-success']>) => void>();
    uploadCtxProvider.addEventListener('file-added', fileAddedHandler);
    uploadCtxProvider.addEventListener('file-upload-start', uploadStartHandler);
    uploadCtxProvider.addEventListener('file-upload-success', uploadSuccessHandler);
    uploadCtxProvider.addEventListener('common-upload-success', commonSuccessHandler);

    const entry = api.addFileFromUploadcareFile(file);

    // Added in its completed state, referencing the existing file.
    expect(entry.uuid).toBe(file.uuid);
    expect(entry.cdnUrl).toBe(file.cdnUrl);
    expect(entry.name).toBe(file.originalFilename);
    expect(entry.size).toBe(file.size);
    expect(entry.isImage).toBe(file.isImage);
    // `fileInfo` being set is what marks the entry as already uploaded.
    expect(entry.fileInfo?.uuid).toBe(file.uuid);

    // Adding an already-uploaded file fires the success events on its own — no `uploadAll()` needed.
    const successPayload = await vi.waitFor(() => {
      expect(uploadSuccessHandler).toHaveBeenCalled();
      return uploadSuccessHandler.mock.calls[0][0].detail;
    });
    expect(successPayload).toMatchObject(expect.objectContaining({ uuid: file.uuid }));

    // The collection reaches the success state as a whole.
    const commonPayload = await vi.waitFor(() => {
      expect(commonSuccessHandler).toHaveBeenCalled();
      return commonSuccessHandler.mock.calls[0][0].detail;
    });
    expect(commonPayload.status).toBe('success');

    // The file was announced as added, and was never uploaded (it already carried fileInfo).
    expect(fileAddedHandler).toHaveBeenCalled();
    expect(uploadStartHandler).not.toHaveBeenCalled();
  }, 30_000);

  it('should not duplicate events after uploader add/removal', async () => {
    for (let i = 0; i < 5; i++) {
      const uploader = page.getByTestId('uc-file-uploader-regular').query()!;
      uploader.remove();

      page.render(<uc-file-uploader-regular ctx-name={uploader.getAttribute('ctx-name')!}></uc-file-uploader-regular>);
    }

    const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = uploadCtxProvider.api;

    const eventHandler = vi.fn<(e: CustomEvent<EventPayload['file-added']>) => void>();

    uploadCtxProvider.addEventListener('file-added', eventHandler);

    const url = TEST_IMAGE_URL;
    api.addFileFromUrl(url);

    const eventPayload = await vi.waitFor(() => {
      expect(eventHandler).toHaveBeenCalledOnce();
      return eventHandler.mock.calls[0][0].detail;
    });

    expect(eventPayload).toMatchObject(expect.objectContaining({ status: 'idle', externalUrl: url }));
  });

  it('should emit events after uploader re-mount', async () => {
    const uploader = page.getByTestId('uc-file-uploader-regular').query()!;
    for (let i = 0; i < 5; i++) {
      uploader.remove();
      page.render(uploader);
    }

    const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = uploadCtxProvider.api;

    const eventHandler = vi.fn<(e: CustomEvent<EventPayload['file-added']>) => void>();

    uploadCtxProvider.addEventListener('file-added', eventHandler);

    const url = TEST_IMAGE_URL;
    api.addFileFromUrl(url);

    const eventPayload = await vi.waitFor(() => {
      expect(eventHandler).toHaveBeenCalledOnce();
      return eventHandler.mock.calls[0][0].detail;
    });

    expect(eventPayload).toMatchObject(expect.objectContaining({ status: 'idle', externalUrl: url }));
  });

  describe('setCurrentActivity', () => {
    it('should set cloud-image-edit activity with params', async () => {
      const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = uploadCtxProvider.getAPI();

      const url = TEST_IMAGE_URL;
      api.addFileFromUrl(url);

      const eventHandler = (event: CustomEvent<EventPayload['file-upload-success']>) => {
        const detail = event.detail as EventPayload['file-upload-success'];
        api.setCurrentActivity('cloud-image-edit', { internalId: detail.internalId });
        api.setModalState(true);
      };

      uploadCtxProvider.addEventListener('file-upload-success', eventHandler);

      const startFrom = page.getByTestId('uc-start-from');
      const cloudImageEdit = page.getByTestId('uc-cloud-image-editor-activity');
      await expect.element(startFrom).not.toBeVisible();
      await expect.element(cloudImageEdit).toBeVisible();
    });

    it('should open external source activity with defined source', async () => {
      const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = uploadCtxProvider.getAPI();

      api.setCurrentActivity('external', { externalSourceType: 'dropbox' });
      api.setModalState(true);

      const startFrom = page.getByTestId('uc-start-from');
      const externalSource = page.getByTestId('uc-external-source');

      await expect.element(startFrom).not.toBeVisible();
      await expect.element(externalSource).toBeVisible();

      await vi.waitFor(() => {
        const iframe = (externalSource.query() as HTMLElement | null)?.querySelector(
          'iframe',
        ) as HTMLIFrameElement | null;
        expect(iframe).toBeTruthy();
        // Not the best option to verify correct source, probably we should add some data- or testid attributes for external source activity
        expect(iframe!.src).toContain('/dropbox');
      });
    });
  });

  describe('historyBack', () => {
    it('should navigate back to the previous activity', async () => {
      const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = uploadCtxProvider.getAPI();

      api.initFlow();

      const startFrom = page.getByTestId('uc-start-from');
      await expect.element(startFrom).toBeVisible();

      api.setCurrentActivity('url');
      api.setModalState(true);

      const urlSource = page.getByTestId('uc-url-source');
      await expect.element(urlSource).toBeVisible();

      api.historyBack();

      await expect.element(startFrom).toBeVisible();
      await expect.element(urlSource).not.toBeInTheDocument();
    });
  });

  describe('initFlow', () => {
    it('should open the start from activity by default', async () => {
      const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = uploadCtxProvider.getAPI();

      api.initFlow();

      const startFrom = page.getByTestId('uc-start-from');
      await expect.element(startFrom).toBeVisible();
    });

    it('should open system dialog for the single local source', async () => {
      const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const config = page.getByTestId('uc-config').query()! as Config;
      const api = uploadCtxProvider.getAPI();

      const openSystemDialogSpy = vi.spyOn(api, 'openSystemDialog').mockImplementation(() => {});

      config.sourceList = 'local';
      api.initFlow();

      await vi.waitFor(() => {
        expect(openSystemDialogSpy).toHaveBeenCalled();
      });

      openSystemDialogSpy.mockRestore();
    });

    it('should open the single activity in the source list', async () => {
      const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const config = page.getByTestId('uc-config').query()! as Config;
      const api = uploadCtxProvider.getAPI();

      config.sourceList = 'url';
      api.initFlow();

      const urlSource = page.getByTestId('uc-url-source');
      await expect.element(urlSource).toBeVisible();
    });

    // This is specific case of CKEditor integration, where they update source list and call initFlow on the next tick, so we need to ensure that it works correctly in this scenario
    it('should handle initFlow right after updating sourceList', async () => {
      const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const config = page.getByTestId('uc-config').query()! as HTMLElement;
      const api = uploadCtxProvider.getAPI();

      config.setAttribute('source-list', 'dropbox');
      api.initFlow();

      const externalSource = page.getByTestId('uc-external-source');
      await expect.element(externalSource).toBeVisible();

      config.setAttribute('source-list', 'url');
      api.initFlow();

      const urlSource = page.getByTestId('uc-url-source');
      await expect.element(urlSource).toBeVisible();
    });
  });
});
