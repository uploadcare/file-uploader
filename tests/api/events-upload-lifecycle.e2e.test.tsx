import { describe, expect, it, vi } from 'vitest';
import { delay } from '@/utils/delay';
import { IMAGE } from '~/tests/fixtures/files';
import { TEST_IMAGE_URL } from '~/tests/utils/constants';
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

/**
 * Negative wait: the ordered assertions claim nothing *else* fires, and no signal marks "no more events". Longer than
 * the 300ms `_flushOutputItems` debounce, so every trailing `change` has landed.
 */
const settle = () => delay(1000);

const CHANGE = 'change' as const;
const PROGRESS = ['file-upload-progress', 'common-upload-progress'] as const;

describe('events: upload lifecycle', () => {
  it('fires the full ordered sequence for a single local file', async () => {
    const { api, provider } = await renderSolution();
    const recorder = recordEvents(provider);

    api.addFileFromObject(IMAGE.PIXEL);
    await recorder.waitFor('file-added');
    api.uploadAll();

    await recorder.waitFor('common-upload-success');
    await settle();

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

    await recorder.waitFor('common-upload-success');
    await settle();

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
    const { api, provider } = await renderSolution();
    const recorder = recordEvents(provider);

    api.addFileFromObject(IMAGE.PIXEL);
    api.addFileFromObject(IMAGE.SQUARE);
    await vi.waitFor(() => expect(recorder.detailsOf('file-added')).toHaveLength(2), { timeout: 20_000 });
    api.uploadAll();

    await recorder.waitFor('common-upload-success');
    await settle();

    expect(recorder.detailsOf('file-added')).toHaveLength(2);
    expect(recorder.detailsOf('file-upload-start')).toHaveLength(2);
    expect(recorder.detailsOf('file-upload-success')).toHaveLength(2);
    // The common-* events describe the collection, so they fire once regardless of the file count.
    expect(recorder.detailsOf('common-upload-start')).toHaveLength(1);
    expect(recorder.detailsOf('common-upload-success')).toHaveLength(1);
    expect(recorder.detailsOf(CHANGE).at(-1)).toMatchObject({ status: 'success', successCount: 2 });
  });

  it('fires file-removed and a trailing change when a file is removed', async () => {
    const { api, provider } = await renderSolution();
    const recorder = recordEvents(provider);

    const entry = api.addFileFromObject(IMAGE.PIXEL);
    await recorder.waitFor('file-added');
    await settle();
    recorder.clear();

    api.removeFileByInternalId(entry.internalId);
    await recorder.waitFor('file-removed');
    await settle();

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
    await recorder.waitFor('common-upload-failed');
    await settle();

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
    await settle();

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
