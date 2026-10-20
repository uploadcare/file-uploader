import { describe, expect, it, vi } from 'vitest';
import { delay } from '@/utils/delay';
import { IMAGE } from '~/tests/fixtures/files';
import { TEST_IMAGE_URL } from '~/tests/utils/constants';
import { recordEvents } from '~/tests/utils/event-recorder';
import { openModal, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * Public events driven from the UI rather than the API: modal/activity events and `file-added` from the built-in
 * sources. The ordered assertions are exact, so a reordered, dropped or extra event fails the test.
 */

/**
 * Negative wait: the ordered assertions claim nothing *else* fires, and no signal marks "no more events". Longer than
 * the 300ms `_flushOutputItems` debounce, so every trailing `change` has landed.
 */
const settle = () => delay(1000);

const WAIT = { timeout: 20_000, interval: 50 };

describe('events: UI interaction', () => {
  const clickInUploadList = async (root: HTMLElement, selector: string) => {
    const uploadList = within(root).getByTestId('uc-upload-list').query()!;
    const button = await vi.waitFor(() => {
      const found = uploadList.querySelector<HTMLButtonElement>(selector);
      if (!found || found.hidden || found.disabled) throw new Error(`"${selector}" is not clickable`);
      return found;
    }, WAIT);
    button.click();
  };

  it('fires activity-change then modal-open when the modal is opened', async () => {
    const { provider, root } = await renderSolution();
    const recorder = recordEvents(provider);

    await openModal(root);
    await settle();

    expect(recorder.types).toEqual(['activity-change', 'modal-open']);
    expect(recorder.detailsOf('activity-change')[0]).toEqual({ activity: 'start-from' });
    expect(recorder.detailsOf('modal-open')[0]).toEqual({ modalId: 'start-from' });
  });

  it('fires upload-click and done-click from the upload list buttons', { timeout: 60_000 }, async () => {
    // Without confirmUpload the list uploads on its own and never shows the Upload button.
    const { api, provider, root } = await renderSolution('regular', { confirmUpload: true });
    const recorder = recordEvents(provider);

    api.addFileFromObject(IMAGE.PIXEL);
    api.setCurrentActivity('upload-list');
    api.setModalState(true);
    await expect.element(within(root).getByTestId('uc-upload-list')).toBeVisible();
    await settle();
    recorder.clear();

    await clickInUploadList(root, '.uc-upload-btn');
    expect(recorder.types[0]).toBe('upload-click');
    expect(recorder.types[1]).toBe('common-upload-start');

    await recorder.waitFor('common-upload-success');
    await clickInUploadList(root, '.uc-done-btn');
    await settle();

    expect(recorder.detailsOf('done-click')).toHaveLength(1);
    expect(recorder.detailsOf('done-click')[0]).toMatchObject({ status: 'success', successCount: 1 });
    expect(recorder.detailsOf('modal-close')[0]).toEqual({ modalId: 'upload-list', hasActiveModals: false });
  });
});

describe('events: sources', () => {
  /** Picks a source button out of the start-from list by its registered id. */
  const clickSource = async (root: HTMLElement, sourceId: string) => {
    await openModal(root);
    const button = await vi.waitFor(() => {
      const found = root.querySelector<HTMLButtonElement>(`uc-source-btn[data-source-id="${sourceId}"] button`);
      if (!found) throw new Error(`Source button "${sourceId}" was not rendered`);
      return found;
    }, WAIT);
    button.click();
  };

  it('fires file-added with the camera source after a shot is accepted', { timeout: 60_000 }, async () => {
    const { provider, root } = await renderSolution();
    const recorder = recordEvents(provider);

    await clickSource(root, 'camera');
    // The fake media device comes from the chromium launch flags in vitest.config.ts.
    const shot = within(root).getByTestId('uc-camera-source--shot');
    await expect.element(shot).toBeVisible();
    recorder.clear();

    await shot.click();
    const accept = within(root).getByTestId('uc-camera-source--accept');
    await expect.element(accept).toBeVisible();
    await accept.click();

    const added = await recorder.waitFor('file-added');
    expect(added.source).toBe('camera');
    expect(added.status).toBe('idle');
    expect(added.name).toContain('camera');
  });

  it('fires file-added for every file picked in an external source', { timeout: 60_000 }, async () => {
    const { provider, root } = await renderSolution();
    const recorder = recordEvents(provider);

    await clickSource(root, 'dropbox');
    recorder.clear();

    // Drive the remote picker through its message bridge instead of the real social app. The block mounts an
    // iframe in `initCallback` and mounts a fresh one on the next tick when `*currentActivityParams` settles
    // (ExternalSource.ts:92), and the bridge only accepts messages from the iframe it currently owns. So the message
    // is re-sent to whatever iframe is mounted until the Done button reacts.
    const selection = {
      type: 'selected-files-change',
      total: 2,
      selectedCount: 2,
      isReady: true,
      isMultipleMode: true,
      selectedFiles: [
        { obj_type: 'selected_file', url: TEST_IMAGE_URL, filename: 'from-dropbox-1.jpg' },
        { obj_type: 'selected_file', url: TEST_IMAGE_URL, filename: 'from-dropbox-2.jpg' },
      ],
    };
    const doneBtn = await vi.waitFor(() => {
      const iframe = root.querySelector<HTMLIFrameElement>('uc-external-source iframe');
      if (!iframe) throw new Error('External source iframe was not mounted');
      window.dispatchEvent(new MessageEvent('message', { data: selection, source: iframe.contentWindow }));
      const found = root.querySelector<HTMLButtonElement>('uc-external-source .uc-done-btn');
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
