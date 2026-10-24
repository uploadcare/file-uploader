import { uploadFile } from '@uploadcare/upload-client';
import { describe, expect, it, vi } from 'vitest';
import { __resetLoggerForTests } from '@/abstract/logger';
import type { EventPayload } from '@/index.js';
import { delay } from '@/utils/delay';
import { IMAGE } from '~/tests/fixtures/files';
import { TEST_IMAGE_URL } from '~/tests/utils/constants';
import '~/types/jsx';
import { renderSolution, within } from '~/tests/utils/render-solution';

describe('UploadCtxProvider api', () => {
  it('reports the idle collection state before any file is added', async () => {
    const { api } = await renderSolution();

    expect(api.getOutputCollectionState()).toMatchObject({
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

  it('adds an already-uploaded file from an UploadcareFile instance and fires the success events without uploading', async () => {
    const { api, provider } = await renderSolution();
    // Upload a real local image via the upload client to get a genuine UploadcareFile.
    const file = await uploadFile(IMAGE.PIXEL, { publicKey: 'demopublickey', store: false });

    const fileAddedHandler = vi.fn<(e: CustomEvent<EventPayload['file-added']>) => void>();
    const uploadStartHandler = vi.fn<(e: CustomEvent<EventPayload['file-upload-start']>) => void>();
    const uploadSuccessHandler = vi.fn<(e: CustomEvent<EventPayload['file-upload-success']>) => void>();
    const commonSuccessHandler = vi.fn<(e: CustomEvent<EventPayload['common-upload-success']>) => void>();
    provider.addEventListener('file-added', fileAddedHandler);
    provider.addEventListener('file-upload-start', uploadStartHandler);
    provider.addEventListener('file-upload-success', uploadSuccessHandler);
    provider.addEventListener('common-upload-success', commonSuccessHandler);

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

  it('replaceFile swaps a file in place: keeps position, new internalId, re-validates, fires natural add/remove events', async () => {
    // An `upload`-time validator runs once per uploaded file and is then skipped
    // on later changes. Seeing it run for the replacement proves the new entry
    // gets a fresh validation cycle (the whole point of remove + add).
    const uploadValidated: string[] = [];
    const { api, provider } = await renderSolution('regular', {
      fileValidators: [
        {
          runOn: 'upload',
          validator: (entry) => {
            if (entry.uuid) uploadValidated.push(entry.uuid);
            return undefined;
          },
        },
      ],
    });

    // Three genuine, distinct already-uploaded files.
    const fileA = await uploadFile(IMAGE.PIXEL, { publicKey: 'demopublickey', store: false });
    const fileB = await uploadFile(IMAGE.PIXEL, { publicKey: 'demopublickey', store: false });
    const fileC = await uploadFile(IMAGE.PIXEL, { publicKey: 'demopublickey', store: false });

    const addedHandler = vi.fn<(e: CustomEvent<EventPayload['file-added']>) => void>();
    const removedHandler = vi.fn<(e: CustomEvent<EventPayload['file-removed']>) => void>();
    const successHandler = vi.fn<(e: CustomEvent<EventPayload['file-upload-success']>) => void>();
    provider.addEventListener('file-added', addedHandler);
    provider.addEventListener('file-removed', removedHandler);
    provider.addEventListener('file-upload-success', successHandler);

    // Two entries; we'll replace the FIRST and assert it stays first.
    const entryA = api.addFileFromUploadcareFile(fileA);
    api.addFileFromUploadcareFile(fileC);
    await vi.waitFor(() => expect(uploadValidated).toContain(fileA.uuid));
    const order = () => api.getOutputCollectionState().allEntries.map((e) => e.uuid);
    expect(order()).toEqual([fileA.uuid, fileC.uuid]);

    const replaced = api.replaceFile(entryA.internalId, fileB, {
      source: 'ai-replace',
      fileName: 'renamed.png',
    });

    // The replacement is a NEW entry (new internalId) carrying fileB.
    expect(replaced.uuid).toBe(fileB.uuid);
    expect(replaced.internalId).not.toBe(entryA.internalId);
    // The `source` and `fileName` options are honored (the latter overriding the
    // uploaded file's own name in the output).
    expect(replaced.source).toBe('ai-replace');
    expect(replaced.name).toBe('renamed.png');

    // It kept fileA's position — still first, fileC still second.
    expect(order()).toEqual([fileB.uuid, fileC.uuid]);

    // Natural events fired: the old entry was removed, the new one added and
    // reported as a completed upload (the replacement is already uploaded).
    await vi.waitFor(() => {
      expect(removedHandler.mock.calls.some((c) => c[0].detail.internalId === entryA.internalId)).toBe(true);
      expect(addedHandler.mock.calls.some((c) => c[0].detail.uuid === fileB.uuid)).toBe(true);
      expect(successHandler.mock.calls.some((c) => c[0].detail.uuid === fileB.uuid)).toBe(true);
    });

    // The replacement ran the upload-time validator — a fresh validation cycle.
    await vi.waitFor(() => expect(uploadValidated).toContain(fileB.uuid));
  }, 30_000);

  describe('setCurrentActivity', () => {
    it('sets the cloud-image-edit activity with params', async () => {
      const { api, provider, root } = await renderSolution();
      api.addFileFromUrl(TEST_IMAGE_URL);

      provider.addEventListener('file-upload-success', (event: CustomEvent<EventPayload['file-upload-success']>) => {
        api.setCurrentActivity('cloud-image-edit', { internalId: event.detail.internalId });
        api.setModalState(true);
      });

      await expect.element(within(root).getByTestId('uc-start-from')).not.toBeVisible();
      await expect.element(within(root).getByTestId('uc-cloud-image-editor-activity')).toBeVisible();
    });

    it('opens the external source activity with the given source', async () => {
      const { api, root } = await renderSolution();
      api.setCurrentActivity('external', { externalSourceType: 'dropbox' });
      api.setModalState(true);

      const externalSource = within(root).getByTestId('uc-external-source');
      await expect.element(within(root).getByTestId('uc-start-from')).not.toBeVisible();
      await expect.element(externalSource).toBeVisible();

      await vi.waitFor(() => {
        const iframe = externalSource.query()?.querySelector('iframe');
        expect(iframe).toBeTruthy();
        // Not the best option to verify correct source, probably we should add some data- or testid attributes for external source activity
        expect(iframe!.src).toContain('/dropbox');
      });
    });
  });

  describe('historyBack', () => {
    it('navigates back to the previous activity', async () => {
      const { api, root } = await renderSolution();
      api.initFlow();

      const startFrom = within(root).getByTestId('uc-start-from');
      await expect.element(startFrom).toBeVisible();

      api.setCurrentActivity('url');
      api.setModalState(true);

      const urlSource = within(root).getByTestId('uc-url-source');
      await expect.element(urlSource).toBeVisible();

      api.historyBack();

      await expect.element(startFrom).toBeVisible();
      await expect.element(urlSource).not.toBeInTheDocument();
    });
  });

  describe('initFlow', () => {
    it('opens the start-from activity by default', async () => {
      const { api, root } = await renderSolution();
      api.initFlow();

      await expect.element(within(root).getByTestId('uc-start-from')).toBeVisible();
    });

    it('opens the system dialog for a single local source', async () => {
      const { api } = await renderSolution('regular', { sourceList: 'local' });
      const openSystemDialogSpy = vi.spyOn(api, 'openSystemDialog').mockImplementation(() => {});

      api.initFlow();

      await vi.waitFor(() => {
        expect(openSystemDialogSpy).toHaveBeenCalled();
      });
    });

    it('opens the single activity in the source list', async () => {
      const { api, root } = await renderSolution('regular', { sourceList: 'url' });
      api.initFlow();

      await expect.element(within(root).getByTestId('uc-url-source')).toBeVisible();
    });

    // This is specific case of CKEditor integration, where they update source list and call initFlow on the next tick, so we need to ensure that it works correctly in this scenario
    it('handles initFlow right after updating sourceList', async () => {
      const { api, config, root } = await renderSolution();

      config.setAttribute('source-list', 'dropbox');
      api.initFlow();

      await expect.element(within(root).getByTestId('uc-external-source')).toBeVisible();

      config.setAttribute('source-list', 'url');
      api.initFlow();

      await expect.element(within(root).getByTestId('uc-url-source')).toBeVisible();
    });
  });

  describe('the collection state an event carries', () => {
    const firstChange = (provider: HTMLElement) =>
      new Promise<EventPayload['change']>((resolve) =>
        provider.addEventListener('change', (e) => resolve((e as CustomEvent<EventPayload['change']>).detail), {
          once: true,
        }),
      );

    it('keeps what the event saw when the handler takes a snapshot()', async () => {
      const { api, provider } = await renderSolution('regular', { multiple: true, confirmUpload: true });
      const snapshot = new Promise<EventPayload['change']>((resolve) =>
        provider.addEventListener(
          'change',
          (e) => resolve((e as CustomEvent<EventPayload['change']>).detail.snapshot()),
          {
            once: true,
          },
        ),
      );
      api.addFileFromObject(IMAGE.PIXEL);
      const seen = await snapshot;
      api.addFileFromObject(IMAGE.SQUARE);
      await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(2);

      expect([seen.totalCount, seen.allEntries.length]).toEqual([1, 1]);
    });

    it('warns about file entries first read after the event', async () => {
      __resetLoggerForTests();
      const warn = vi.spyOn(console, 'warn');
      const { api, provider } = await renderSolution('regular', { confirmUpload: true });
      const change = firstChange(provider);
      api.addFileFromObject(IMAGE.PIXEL);
      const state = await change;
      await delay(0);

      void state.allEntries;
      expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('after the task that created it'));
    });
  });
});
