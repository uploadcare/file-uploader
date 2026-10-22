import { DEMO_IMAGE_UUID } from '@uploadcare/api-emulator';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { withResolvers } from '@/utils/withResolvers';
import { IMAGE } from '~/tests/fixtures/files';
import { TEST_IMAGE_URL } from '~/tests/utils/constants';
import { resetEmulator } from '~/tests/utils/emulator.browser';
import { recordEvents } from '~/tests/utils/event-recorder';
import { renderSolution } from '~/tests/utils/render-solution';
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
    const unobserve = provider.uploadCollection.observeProperties((changeMap) => {
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
    // Set after render on purpose: the doubled failure pair asserted below only happens when the config changes in the
    // same tick the file is added. Passed as an attribute at render time the pair fires once.
    config.maxLocalFileSizeBytes = 1;

    api.addFileFromObject(IMAGE.PIXEL);
    await expect.poll(() => recorder.detailsOf('common-upload-failed')).toHaveLength(2);
    await recorder.waitForAfter(CHANGE, 'common-upload-failed');

    // The failure pair fires twice: once from the `add` validators and once from the `change` validators that run in
    // the next tick. Pinned as-is — this is current behaviour, not an endorsement of it.
    expect(recorder.typesExcluding(CHANGE)).toEqual([
      'file-added',
      'file-upload-failed',
      'common-upload-failed',
      'file-upload-failed',
      'common-upload-failed',
    ]);
    expect(recorder.detailsOf('file-upload-failed')[0].errors[0].type).toBe('FILE_SIZE_EXCEEDED');
    expect(recorder.detailsOf(CHANGE).at(-1)).toMatchObject({ status: 'failed', failedCount: 1 });
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
});
