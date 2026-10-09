import { describe, expect, it, vi } from 'vitest';
import { IMAGE } from '~/tests/fixtures/files';
import { TEST_IMAGE_URL } from '~/tests/utils/constants';
import { recordEvents } from '~/tests/utils/event-recorder';
import { clickSource, openModal, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * Public events driven from the UI rather than the API: modal/activity events and `file-added` from the built-in
 * sources. The ordered assertions are exact, so a reordered, dropped or extra event fails the test.
 */

const WAIT = { timeout: 20_000, interval: 50 };

describe('events: UI interaction', () => {
  const uploadListButton = (root: HTMLElement, name: string) =>
    within(root).getByTestId('uc-upload-list').getByRole('button', { name, exact: true });

  it('fires activity-change then modal-open when the modal is opened', async () => {
    const { api, provider, root } = await renderSolution();
    const recorder = recordEvents(provider);

    await openModal(root);
    // The sentinel: closing it fires modal-close, so the exact list below says nothing else fired before it.
    api.setModalState(false);
    await recorder.waitFor('modal-close');

    expect(recorder.types).toEqual(['activity-change', 'modal-open', 'modal-close']);
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
    await recorder.waitForAfter('change', 'file-added');
    recorder.clear();

    await uploadListButton(root, 'Upload').click();
    expect(recorder.types[0]).toBe('upload-click');
    expect(recorder.types[1]).toBe('common-upload-start');

    await recorder.waitFor('common-upload-success');
    await uploadListButton(root, 'Done').click();
    await recorder.waitFor('modal-close');

    expect(recorder.detailsOf('done-click')).toHaveLength(1);
    expect(recorder.detailsOf('done-click')[0]).toMatchObject({ status: 'success', successCount: 1 });
    expect(recorder.detailsOf('modal-close')[0]).toEqual({ modalId: 'upload-list', hasActiveModals: false });
  });
});

describe('events: sources', () => {
  it('fires file-added with the camera source after a shot is accepted', { timeout: 60_000 }, async () => {
    const { provider, root } = await renderSolution();
    const recorder = recordEvents(provider);

    await clickSource(root, 'Camera');
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

    await clickSource(root, 'Dropbox');
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
    const externalSource = within(root).getByTestId('uc-external-source');
    const done = externalSource.getByRole('button', { name: 'Done', exact: true });
    await vi.waitFor(() => {
      const iframe = externalSource.query()?.querySelector('iframe');
      if (!iframe) throw new Error('External source iframe was not mounted');
      window.dispatchEvent(new MessageEvent('message', { data: selection, source: iframe.contentWindow }));
      // `getByRole` skips hidden elements, so this is null until the selection shows the button.
      const button = done.query() as HTMLButtonElement | null;
      if (!button || button.disabled) throw new Error('Done button is not clickable');
    }, WAIT);
    await done.click();

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
