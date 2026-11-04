import { DEMO_IMAGE_UUID } from '@uploadcare/api-emulator';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { OutputCollectionState } from '@/types';
import { withResolvers } from '@/utils/withResolvers';
import { IMAGE, testFile } from '~/tests/fixtures/files';
import { TEST_IMAGE_URL } from '~/tests/utils/constants';
import { emulatorSession, isLive, resetEmulator } from '~/tests/utils/emulator.browser';
import { type EventRecorder, recordEvents } from '~/tests/utils/event-recorder';
import { type RenderedUploader, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * Baseline for the public event contract: which events fire, and in which order. The ordered assertions are exact, so a
 * reordered, dropped or extra event fails the test.
 *
 * `change` is deliberately excluded from the ordered comparisons: it is debounced twice (300ms collection flush + 20ms
 * emit debounce), so where it lands relative to the upload events depends on network timing. It is asserted separately
 * instead — that it fires and carries the right final state.
 */

const CHANGE = 'change' as const;
const PROGRESS = ['file-upload-progress', 'common-upload-progress'] as const;

/**
 * The sentinel for "everything after an upload has landed": every uploaded file is validated again behind the
 * validation queue's debounce, and anything that revalidation reports goes out before the `change` it sets off. Call it
 * before the upload succeeds; the returned wait ends on that `change`.
 */
const watchPostUploadValidation = (
  { api, provider }: RenderedUploader,
  recorder: EventRecorder,
  internalId: string,
): (() => Promise<void>) => {
  let recordedBefore = -1;
  // Added after the uploader's own observer, so it sees the revalidation result in the same batch, after the uploader.
  const unobserve = provider.uploadCollection.observeProperties(['errors'], (changeMap) => {
    const isUploaded = api.getOutputItem(internalId).isSuccess;
    if (recordedBefore < 0 && isUploaded && changeMap.errors?.has(internalId)) recordedBefore = recorder.events.length;
  });
  onTestFinished(unobserve);
  return () =>
    vi.waitFor(
      () => {
        expect(recordedBefore).toBeGreaterThanOrEqual(0);
        expect(recorder.events.slice(recordedBefore).map((event) => event.type)).toContain(CHANGE);
      },
      { timeout: 20_000 },
    );
};

describe('events: upload lifecycle', () => {
  it('fires the full ordered sequence for a single local file', async () => {
    const { api, provider } = await renderSolution();
    const recorder = recordEvents(provider);

    api.addFileFromObject(IMAGE.PIXEL);
    await recorder.waitFor('file-added');
    api.uploadAll();

    await recorder.waitForAfter(CHANGE, 'common-upload-success');

    expect(recorder.typesExcluding(CHANGE)).toEqual([
      'file-added',
      'common-upload-start',
      'file-upload-start',
      'file-upload-progress',
      'common-upload-progress',
      'file-upload-success',
      'file-url-changed',
      'common-upload-success',
    ]);

    const changes = recorder.detailsOf(CHANGE);
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.at(-1)).toMatchObject({ status: 'success', successCount: 1, failedCount: 0 });
  });

  const commonUploadStart = (provider: EventTarget) =>
    new Promise<Pick<OutputCollectionState, 'status' | 'isUploading' | 'uploadingCount'>>((resolve) => {
      provider.addEventListener(
        'common-upload-start',
        (e) => {
          // Read as it fires, as documented: the state is lazy.
          const { status, isUploading, uploadingCount } = (e as CustomEvent<OutputCollectionState>).detail;
          resolve({ status, isUploading, uploadingCount });
        },
        { once: true },
      );
    });

  it('carries an uploading state in common-upload-start', async () => {
    const { api, provider } = await renderSolution('regular', { multiple: true });
    const started = commonUploadStart(provider);

    api.addFileFromObject(IMAGE.PIXEL);
    api.addFileFromObject(IMAGE.SQUARE);
    api.uploadAll();

    const state = await started;
    expect(state).toMatchObject({ status: 'uploading', isUploading: true });
    expect(state.uploadingCount).toBeGreaterThan(0);
  });

  it('carries a failed state in common-upload-start when the list already holds a rejected file', async () => {
    const { api, provider } = await renderSolution('regular', {
      multiple: true,
      fileValidators: [(entry) => (entry.name === 'bad.png' ? { message: 'rejected' } : undefined)],
    });
    const started = commonUploadStart(provider);

    api.addFileFromObject(IMAGE.PIXEL, { fileName: 'bad.png' });
    api.addFileFromObject(IMAGE.SQUARE);
    await vi.waitFor(() => expect(api.getOutputCollectionState().failedCount).toBe(1));
    api.uploadAll();

    const state = await started;
    // A file error makes the whole collection `failed`, even while the rest upload.
    expect(state.status).toBe('failed');
    expect(state.uploadingCount).toBe(1);
  });

  it('fires the full ordered sequence for a file added from a URL', async () => {
    const { api, provider } = await renderSolution();
    const recorder = recordEvents(provider);

    api.addFileFromUrl(TEST_IMAGE_URL);
    await recorder.waitFor('file-added');
    api.uploadAll();

    await recorder.waitForAfter(CHANGE, 'common-upload-success');

    // Progress events are excluded here: a URL upload is polled server-side, so it can finish without reporting any
    // intermediate progress.
    expect(recorder.typesExcluding(CHANGE, ...PROGRESS)).toEqual([
      'file-added',
      'common-upload-start',
      'file-upload-start',
      'file-upload-success',
      'file-url-changed',
      'common-upload-success',
    ]);

    const successPayload = recorder.detailsOf('file-upload-success')[0];
    expect(successPayload.externalUrl).toBe(TEST_IMAGE_URL);
    expect(successPayload.cdnUrl).toBeTruthy();
  });

  it('fires common-upload-success again, with the edited cdnUrl, once per edit in the editor', async () => {
    // v1 (fu-v1) after Apply: `file-url-changed, change, common-upload-success, change`
    // (fu-qa/audit-r3/qa-ui/out/ED1-edit.json).
    const rendered = await renderSolution();
    const { api, provider, root } = rendered;
    const recorder = recordEvents(provider);
    const entry = api.addFileFromUrl(TEST_IMAGE_URL);
    const uploadValidated = watchPostUploadValidation(rendered, recorder, entry.internalId);
    api.uploadAll();
    await uploadValidated();
    expect(recorder.detailsOf('common-upload-success')).toHaveLength(1);
    recorder.clear();
    const successUrls: (string | null)[] = [];
    provider.addEventListener('common-upload-success', (e) =>
      // Read as it fires: the state is lazy.
      successUrls.push((e as CustomEvent<OutputCollectionState>).detail.allEntries[0].cdnUrl),
    );

    api.setCurrentActivity('cloud-image-edit', { internalId: entry.internalId });
    api.setModalState(true);
    // Rotate is the first crop button.
    await userEvent.click(within(root).getByTestId('uc-editor-crop-button-control').nth(0));
    await userEvent.click(within(root).getByRole('button', { name: /apply/i }));

    await recorder.waitForAfter(CHANGE, 'common-upload-success');
    const editedUrl = recorder.detailsOf('file-url-changed').at(-1)?.cdnUrl;
    expect(editedUrl).toContain('/-/rotate/');
    expect(successUrls).toEqual([editedUrl]);
    expect(recorder.typesExcluding(CHANGE, 'activity-change', 'modal-open', 'modal-close')).toEqual([
      'file-url-changed',
      'common-upload-success',
    ]);
  });

  it('fires per-file events for every file when uploading several at once', async () => {
    // `confirmUpload`, so this `uploadAll()` is the only thing that starts an upload. With auto-upload it is a no-op
    // (it skips files still being validated) and the uploader starts each file once its validation lands, so two
    // validations finishing a throttle window apart make two batches and two `common-upload-start`s.
    const { api, provider } = await renderSolution('regular', { confirmUpload: true });
    const recorder = recordEvents(provider);

    api.addFileFromObject(IMAGE.PIXEL);
    api.addFileFromObject(IMAGE.SQUARE);
    await vi.waitFor(
      () => {
        expect(recorder.detailsOf('file-added')).toHaveLength(2);
        expect(api.getOutputCollectionState().allEntries.filter((entry) => !entry.isValidationPending)).toHaveLength(2);
      },
      { timeout: 20_000 },
    );
    api.uploadAll();

    await recorder.waitForAfter(CHANGE, 'common-upload-success');

    expect(recorder.detailsOf('file-added')).toHaveLength(2);
    expect(recorder.detailsOf('file-upload-start')).toHaveLength(2);
    expect(recorder.detailsOf('file-upload-success')).toHaveLength(2);
    // The common-* events describe the collection, so they fire once regardless of the file count.
    expect(recorder.detailsOf('common-upload-start')).toHaveLength(1);
    expect(recorder.detailsOf('common-upload-success')).toHaveLength(1);
    expect(recorder.detailsOf(CHANGE).at(-1)).toMatchObject({ status: 'success', successCount: 2 });
  });

  it('fires common-upload-success once when the files are validated apart after uploading', async () => {
    // Every uploaded file is validated again, and the collection reports success when those results land. Holding each
    // file's post-upload validation on its own gate lands the results in two batches, both seeing every file uploaded.
    const gates = { [IMAGE.PIXEL.name]: withResolvers(), [IMAGE.SQUARE.name]: withResolvers() };
    const { api, provider } = await renderSolution('regular', {
      confirmUpload: true,
      fileValidators: [
        async (entry) => {
          if (entry.status === 'success') await gates[entry.name ?? ''].promise;
          return undefined;
        },
      ],
    });
    const recorder = recordEvents(provider);
    api.addFileFromObject(IMAGE.PIXEL);
    api.addFileFromObject(IMAGE.SQUARE);
    await vi.waitFor(() => {
      expect(recorder.detailsOf('file-added')).toHaveLength(2);
      expect(api.getOutputCollectionState().allEntries.filter((entry) => !entry.isValidationPending)).toHaveLength(2);
    });

    api.uploadAll();
    await vi.waitFor(() => expect(recorder.detailsOf('file-upload-success')).toHaveLength(2), { timeout: 20_000 });
    gates[IMAGE.PIXEL.name].resolve();
    await recorder.waitFor('common-upload-success');

    // The sentinel for "the second batch has been handled": a property observer added now runs after the uploader's
    // own, in the same batch, so once it sees the square's validation result the uploader has seen it too.
    const square = api.getOutputCollectionState().allEntries.find((entry) => entry.name === IMAGE.SQUARE.name);
    let isSquareValidationSeen = false;
    const unobserve = provider.uploadCollection.observeProperties(['errors'], (changeMap) => {
      if (changeMap.errors?.has(square?.internalId ?? '')) isSquareValidationSeen = true;
    });
    onTestFinished(unobserve);
    gates[IMAGE.SQUARE.name].resolve();
    await vi.waitFor(() => expect(isSquareValidationSeen).toBe(true));

    expect(recorder.detailsOf('common-upload-success')).toHaveLength(1);
  });

  it('fires file-upload-start for an upload that finishes before its start is flushed', async () => {
    // The collection reports its changes in batches, on a 0ms timer. A busy or background tab runs that timer late
    // while the network keeps answering, so an upload can start and finish inside one batch. Answering in the task
    // that asked gets there on purpose: an upload by uuid is one body-less `GET /info/`, which `hold: false` answers
    // before the timer runs. Live, the real API is slower than the timer, so the race is not reproduced there.
    (await resetEmulator())?.on({}, ({ next }) => next(), { hold: false });
    const { api, provider } = await renderSolution('regular', { confirmUpload: true });
    const recorder = recordEvents(provider);
    api.addFileFromUuid(DEMO_IMAGE_UUID);
    await recorder.waitFor('file-added');
    await vi.waitFor(() => {
      expect(api.getOutputCollectionState().allEntries).toMatchObject([{ isValidationPending: false }]);
    });

    api.uploadAll();
    await recorder.waitFor('common-upload-success');

    expect(recorder.detailsOf('file-upload-start')).toHaveLength(1);
  });

  it('fires file-removed and a trailing change when a file is removed', async () => {
    const { api, provider } = await renderSolution();
    const recorder = recordEvents(provider);

    const entry = api.addFileFromObject(IMAGE.PIXEL);
    // The file uploads on its own; drop its events once the upload is done.
    await recorder.waitForAfter(CHANGE, 'common-upload-success');
    recorder.clear();

    api.removeFileByInternalId(entry.internalId);
    await recorder.waitForAfter(CHANGE, 'file-removed');

    // Removing a file recomputes the common progress, which re-emits it.
    expect(recorder.types).toEqual(['file-removed', 'common-upload-progress', CHANGE]);
    expect(recorder.detailsOf('file-removed')[0].internalId).toBe(entry.internalId);
    expect(recorder.detailsOf(CHANGE)[0]).toMatchObject({ totalCount: 0 });
  });

  it('fires the failure events when a file does not pass validation', async () => {
    const { api, config, provider } = await renderSolution();
    const recorder = recordEvents(provider);
    // Set after render on purpose: the config changing in the same tick the file is added re-runs the validators in
    // the next tick, with the same verdict. That verdict is reported once.
    config.maxLocalFileSizeBytes = 1;

    const first = api.addFileFromObject(IMAGE.PIXEL);
    await expect.poll(() => recorder.detailsOf('common-upload-failed')).toHaveLength(1);
    // The sentinel: a second file, added once the first has settled, fails in turn. A repeat report for the first
    // would land before this one.
    await recorder.waitForAfter(CHANGE, 'common-upload-failed');
    const second = api.addFileFromObject(IMAGE.PIXEL);
    await expect
      .poll(() => recorder.detailsOf('file-upload-failed').map((entry) => entry.internalId))
      .toContain(second.internalId);

    expect(recorder.detailsOf('file-upload-failed').map((entry) => entry.internalId)).toEqual([
      first.internalId,
      second.internalId,
    ]);
    expect(recorder.detailsOf('file-upload-failed')[0].errors[0].type).toBe('FILE_SIZE_EXCEEDED');
    await recorder.waitForAfter(CHANGE, 'file-upload-failed');
    expect(recorder.detailsOf(CHANGE).at(-1)).toMatchObject({ status: 'failed', failedCount: 2 });
  });

  // Fake-only: the emulator rejects one file and holds the other.
  it.skipIf(isLive)('fires common-upload-failed once, after the last file of the batch settles', async () => {
    const released = withResolvers();
    emulatorSession().on('POST /base/', async ({ request, next }) => {
      const file = (await request.clone().formData()).get('file');
      if (file instanceof File && file.name === 'rejected.jpg') {
        // The Upload API answers a JSON error with status 200 and the error in the body.
        return Response.json({ error: { status_code: 400, content: 'File is not allowed.' } });
      }
      await released.promise;
      return next();
    });
    const { api, provider } = await renderSolution();
    const recorder = recordEvents(provider);
    // Copied when it fires: the recorder keeps the live state, which a later read would see newer.
    const failed: OutputCollectionState[] = [];
    provider.addEventListener('common-upload-failed', (e) => failed.push(e.detail.snapshot()));

    api.addFileFromObject(testFile('rejected.jpg'));
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();
    // The sentinel: `change` is debounced longer than `common-upload-failed`, so a report of the rejection made while
    // the other file still uploads would land before it.
    await recorder.waitForAfter(CHANGE, 'file-upload-failed');
    released.resolve();
    // The same sentinel after the other file's success: a report that success triggers lands before it too.
    await recorder.waitForAfter(CHANGE, 'file-upload-success');

    const settled = recorder.typesExcluding(CHANGE, ...PROGRESS);
    expect(settled.filter((type) => type === 'common-upload-failed')).toHaveLength(1);
    expect(settled.indexOf('common-upload-failed')).toBeGreaterThan(settled.indexOf('file-upload-success'));
    expect(failed).toEqual([expect.objectContaining({ status: 'failed', successCount: 1, failedCount: 1 })]);
  });

  // Fake-only: the emulator rejects one file and holds the other until the rejection is reported.
  it.skipIf(isLive)('fires common-upload-failed once when a file is rejected next to one that uploads', async () => {
    const released = withResolvers();
    emulatorSession().on('POST /base/', async ({ request, next }) => {
      const file = (await request.clone().formData()).get('file');
      if (file instanceof File && file.name === 'rejected.jpg') {
        return Response.json({ error: { status_code: 400, content: 'File is not allowed.' } });
      }
      await released.promise;
      return next();
    });
    const uploader = await renderSolution();
    const { api, provider } = uploader;
    const recorder = recordEvents(provider);
    // Copied when it fires: the recorder keeps the live state, which a later read would see newer.
    const failed: OutputCollectionState[] = [];
    provider.addEventListener('common-upload-failed', (e) => failed.push(e.detail.snapshot()));
    api.addFileFromObject(testFile('rejected.jpg'));
    const uploaded = api.addFileFromObject(IMAGE.PIXEL);
    const isRevalidated = watchPostUploadValidation(uploader, recorder, uploaded.internalId);

    await recorder.waitFor('file-upload-failed');
    released.resolve();
    await isRevalidated();

    expect(failed).toEqual([expect.objectContaining({ status: 'failed', successCount: 1, failedCount: 1 })]);
  });

  it('fires common-upload-failed once, after the batch settles, when a file is rejected by validation', async () => {
    const uploader = await renderSolution('regular', { imgOnly: true });
    const { api, provider } = uploader;
    const recorder = recordEvents(provider);
    api.addFileFromObject(testFile('rejected.txt', 'text/plain'));
    const uploaded = api.addFileFromObject(IMAGE.PIXEL);
    const isRevalidated = watchPostUploadValidation(uploader, recorder, uploaded.internalId);

    await isRevalidated();

    const settled = recorder.typesExcluding(CHANGE, ...PROGRESS);
    expect(settled.filter((type) => type === 'common-upload-failed')).toHaveLength(1);
    expect(settled.indexOf('common-upload-failed')).toBeGreaterThan(settled.indexOf('file-upload-success'));
  });

  it('fires common-upload-failed once when fewer files than multipleMin are uploaded', async () => {
    const uploader = await renderSolution();
    const { api, config, provider } = uploader;
    const recorder = recordEvents(provider);
    // The empty list is already too short; wait for that report itself so only what the added file sets off counts.
    config.multipleMin = 2;
    await expect.poll(() => recorder.detailsOf('common-upload-failed')).toHaveLength(1);
    recorder.clear();
    const uploaded = api.addFileFromObject(IMAGE.PIXEL);
    const isRevalidated = watchPostUploadValidation(uploader, recorder, uploaded.internalId);

    await isRevalidated();

    expect(recorder.detailsOf('common-upload-failed')).toEqual([
      expect.objectContaining({ status: 'failed', totalCount: 1, successCount: 1 }),
    ]);
  });

  it('fires common-upload-failed again once an uploadAll() batch settles with too few files', async () => {
    const uploader = await renderSolution('regular', { confirmUpload: true });
    const { api, config, provider } = uploader;
    const recorder = recordEvents(provider);
    // The empty list is already too short; wait for that report itself so only what the added file sets off counts.
    config.multipleMin = 2;
    await expect.poll(() => recorder.detailsOf('common-upload-failed')).toHaveLength(1);
    recorder.clear();

    const uploaded = api.addFileFromObject(IMAGE.PIXEL);
    await expect
      .poll(() => recorder.detailsOf('common-upload-failed'))
      .toEqual([expect.objectContaining({ status: 'failed', totalCount: 1, successCount: 0 })]);
    recorder.clear();
    const isRevalidated = watchPostUploadValidation(uploader, recorder, uploaded.internalId);
    // `uploadAll()` skips a file its validators have not passed yet.
    await expect.poll(() => api.getOutputItem(uploaded.internalId).isValidationPending).toBe(false);
    api.uploadAll();

    await isRevalidated();

    expect(recorder.detailsOf('common-upload-failed')).toEqual([
      expect.objectContaining({ status: 'failed', totalCount: 1, successCount: 1 }),
    ]);
  });

  it('fires group-created after the upload succeeds when groupOutput is enabled', async () => {
    const { api, provider } = await renderSolution('regular', { groupOutput: true });
    const recorder = recordEvents(provider);

    api.addFileFromObject(IMAGE.PIXEL);
    await recorder.waitFor('file-added');
    api.uploadAll();

    const groupState = await recorder.waitFor('group-created');
    expect(groupState.group?.cdnUrl).toBeTruthy();
    await recorder.waitForAfter(CHANGE, 'common-upload-success');

    // group-created is excluded from the ordered comparison: creating the group is a separate network call, so it can
    // land either side of common-upload-success.
    expect(recorder.typesExcluding(CHANGE, 'group-created')).toEqual([
      'file-added',
      'common-upload-start',
      'file-upload-start',
      'file-upload-progress',
      'common-upload-progress',
      'file-upload-success',
      'file-url-changed',
      'common-upload-success',
    ]);
    expect(recorder.detailsOf('group-created')[0].group?.cdnUrl).toBeTruthy();
  });

  it('creates a new group when a file is removed from a grouped collection', async () => {
    const { api, provider } = await renderSolution('regular', { groupOutput: true, multiple: true });
    const recorder = recordEvents(provider);

    const kept = api.addFileFromObject(IMAGE.PIXEL);
    const removed = api.addFileFromObject(IMAGE.SQUARE);
    api.uploadAll();
    await expect.poll(() => recorder.detailsOf('group-created')).toHaveLength(1);
    expect(recorder.detailsOf('group-created')[0].group?.filesCount).toBe(2);

    api.removeFileByInternalId(removed.internalId);

    await expect.poll(() => recorder.detailsOf('group-created')).toHaveLength(2);
    const [first, second] = recorder.detailsOf('group-created');
    expect(second.group?.filesCount).toBe(1);
    expect(second.group?.uuid).not.toBe(first.group?.uuid);
    expect(second.allEntries.map((entry) => entry.internalId)).toEqual([kept.internalId]);
  });
});
