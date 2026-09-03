import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, UploadCtxProvider } from '@/index.js';
import { delay } from '@/utils/delay';
import { IMAGE } from './fixtures/files';
import { TEST_IMAGE_URL } from './utils/constants';
import { type EventRecorder, recordEvents } from './utils/event-recorder';
import { getCtxName } from './utils/test-renderer';
import '../types/jsx';

/**
 * Baseline for the public event contract: which events fire, and in which order. The ordered assertions are exact, so a
 * reordered, dropped or extra event fails the test.
 *
 * `change` is deliberately excluded from the ordered comparisons: it is debounced twice (300ms collection flush + 20ms
 * emit debounce), so where it lands relative to the upload events depends on network timing. It is asserted separately
 * instead — that it fires and carries the right final state.
 */

/** Longer than the 300ms `_flushOutputItems` debounce, so every trailing `change` has landed. */
const SETTLE_MS = 1000;

const CHANGE = 'change' as const;
const PROGRESS = ['file-upload-progress', 'common-upload-progress'] as const;

let provider: UploadCtxProvider;
let config: Config;
let recorder: EventRecorder;

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(async () => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );
  await delay(0);
  provider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
  config = page.getByTestId('uc-config').query()! as Config;
  recorder = recordEvents(provider);
});

const api = () => provider.api;

describe('Events: upload lifecycle', () => {
  it('fires the full ordered sequence for a single local file', async () => {
    api().addFileFromObject(IMAGE.PIXEL);
    await recorder.waitFor('file-added');
    api().uploadAll();

    await recorder.waitFor('common-upload-success');
    await delay(SETTLE_MS);

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
    api().addFileFromUrl(TEST_IMAGE_URL);
    await recorder.waitFor('file-added');
    api().uploadAll();

    await recorder.waitFor('common-upload-success');
    await delay(SETTLE_MS);

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
    api().addFileFromObject(IMAGE.PIXEL);
    api().addFileFromObject(IMAGE.SQUARE);
    await vi.waitFor(() => expect(recorder.detailsOf('file-added')).toHaveLength(2), { timeout: 20_000 });
    api().uploadAll();

    await recorder.waitFor('common-upload-success');
    await delay(SETTLE_MS);

    expect(recorder.detailsOf('file-added')).toHaveLength(2);
    expect(recorder.detailsOf('file-upload-start')).toHaveLength(2);
    expect(recorder.detailsOf('file-upload-success')).toHaveLength(2);
    // The common-* events describe the collection, so they fire once regardless of the file count.
    expect(recorder.detailsOf('common-upload-start')).toHaveLength(1);
    expect(recorder.detailsOf('common-upload-success')).toHaveLength(1);
    expect(recorder.detailsOf(CHANGE).at(-1)).toMatchObject({ status: 'success', successCount: 2 });
  });

  it('fires file-removed and a trailing change when a file is removed', async () => {
    const entry = api().addFileFromObject(IMAGE.PIXEL);
    await recorder.waitFor('file-added');
    await delay(SETTLE_MS);
    recorder.clear();

    api().removeFileByInternalId(entry.internalId);
    await recorder.waitFor('file-removed');
    await delay(SETTLE_MS);

    // Removing a file recomputes the common progress, which re-emits it.
    expect(recorder.types).toEqual(['file-removed', 'common-upload-progress', CHANGE]);
    expect(recorder.detailsOf('file-removed')[0].internalId).toBe(entry.internalId);
    expect(recorder.detailsOf(CHANGE)[0]).toMatchObject({ totalCount: 0 });
  });

  it('fires the failure events when a file does not pass validation', async () => {
    config.maxLocalFileSizeBytes = 1;

    api().addFileFromObject(IMAGE.PIXEL);
    await recorder.waitFor('common-upload-failed');
    await delay(SETTLE_MS);

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
    config.groupOutput = true;

    api().addFileFromObject(IMAGE.PIXEL);
    await recorder.waitFor('file-added');
    api().uploadAll();

    const groupState = await recorder.waitFor('group-created');
    expect(groupState.group?.cdnUrl).toBeTruthy();
    await delay(SETTLE_MS);

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

describe('Events: UI interaction', () => {
  const clickInUploadList = async (selector: string) => {
    const uploadList = page.getByTestId('uc-upload-list').query()!;
    const button = await vi.waitFor(() => {
      const found = uploadList.querySelector<HTMLButtonElement>(selector);
      if (!found || found.hidden || found.disabled) throw new Error(`"${selector}" is not clickable`);
      return found;
    }, WAIT);
    button.click();
  };
  const WAIT = { timeout: 20_000, interval: 50 };

  it('fires activity-change then modal-open when the modal is opened', async () => {
    await page.getByText('Upload files', { exact: true }).click();
    await expect.element(page.getByTestId('uc-start-from')).toBeVisible();
    await delay(SETTLE_MS);

    expect(recorder.types).toEqual(['activity-change', 'modal-open']);
    expect(recorder.detailsOf('activity-change')[0]).toEqual({ activity: 'start-from' });
    expect(recorder.detailsOf('modal-open')[0]).toEqual({ modalId: 'start-from' });
  });

  it('fires upload-click and done-click from the upload list buttons', { timeout: 60_000 }, async () => {
    // Without confirmUpload the list uploads on its own and never shows the Upload button.
    config.confirmUpload = true;

    api().addFileFromObject(IMAGE.PIXEL);
    api().setCurrentActivity('upload-list');
    api().setModalState(true);
    await expect.element(page.getByTestId('uc-upload-list')).toBeVisible();
    await delay(SETTLE_MS);
    recorder.clear();

    await clickInUploadList('.uc-upload-btn');
    expect(recorder.types[0]).toBe('upload-click');
    expect(recorder.types[1]).toBe('common-upload-start');

    await recorder.waitFor('common-upload-success');
    await clickInUploadList('.uc-done-btn');
    await delay(SETTLE_MS);

    expect(recorder.detailsOf('done-click')).toHaveLength(1);
    expect(recorder.detailsOf('done-click')[0]).toMatchObject({ status: 'success', successCount: 1 });
    expect(recorder.detailsOf('modal-close')[0]).toEqual({ modalId: 'upload-list', hasActiveModals: false });
  });
});

describe('Events: sources', () => {
  /** Picks a source button out of the start-from list by its registered id. */
  const clickSource = async (sourceId: string) => {
    await page.getByText('Upload files', { exact: true }).click();
    await expect.element(page.getByTestId('uc-start-from')).toBeVisible();
    const button = await vi.waitFor(() => {
      const found = document.querySelector<HTMLButtonElement>(`uc-source-btn[data-source-id="${sourceId}"] button`);
      if (!found) throw new Error(`Source button "${sourceId}" was not rendered`);
      return found;
    }, WAIT);
    button.click();
  };

  const WAIT = { timeout: 20_000, interval: 50 };

  it('fires file-added with the camera source after a shot is accepted', { timeout: 60_000 }, async () => {
    await clickSource('camera');
    // The fake media device comes from the chromium launch flags in vitest.config.ts.
    const shot = page.getByTestId('uc-camera-source--shot');
    await expect.element(shot).toBeVisible();
    recorder.clear();

    await shot.click();
    const accept = page.getByTestId('uc-camera-source--accept');
    await expect.element(accept).toBeVisible();
    await accept.click();

    const added = await recorder.waitFor('file-added');
    expect(added.source).toBe('camera');
    expect(added.status).toBe('idle');
    expect(added.name).toContain('camera');
  });

  it('fires file-added for every file picked in an external source', { timeout: 60_000 }, async () => {
    await clickSource('dropbox');
    const iframe = await vi.waitFor(() => {
      const found = document.querySelector('uc-external-source iframe');
      if (!found) throw new Error('External source iframe was not mounted');
      return found as HTMLIFrameElement;
    }, WAIT);
    recorder.clear();

    // Drive the remote picker through its message bridge instead of the real social app.
    window.dispatchEvent(
      new MessageEvent('message', {
        source: iframe.contentWindow,
        data: {
          type: 'selected-files-change',
          total: 2,
          selectedCount: 2,
          isReady: true,
          isMultipleMode: true,
          selectedFiles: [
            { obj_type: 'selected_file', url: TEST_IMAGE_URL, filename: 'from-dropbox-1.jpg' },
            { obj_type: 'selected_file', url: TEST_IMAGE_URL, filename: 'from-dropbox-2.jpg' },
          ],
        },
      }),
    );

    const doneBtn = await vi.waitFor(() => {
      const found = document.querySelector<HTMLButtonElement>('uc-external-source .uc-done-btn');
      if (!found || found.hidden || found.disabled) throw new Error('Done button is not clickable');
      return found;
    }, WAIT);
    doneBtn.click();

    await vi.waitFor(() => {
      expect(recorder.detailsOf('file-added')).toHaveLength(2);
    }, WAIT);
    expect(
      recorder.detailsOf('file-added').map(({ source, externalUrl, name }) => ({ source, externalUrl, name })),
    ).toEqual([
      { source: 'dropbox', externalUrl: TEST_IMAGE_URL, name: 'from-dropbox-1.jpg' },
      { source: 'dropbox', externalUrl: TEST_IMAGE_URL, name: 'from-dropbox-2.jpg' },
    ]);
  });
});
