import { beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { delay } from '@/utils/delay';
import { IMAGE } from './fixtures/files';
import { expectActivity, expectModal, modalDialog, renderSolution, within } from './utils/render-solution';
import '../types/jsx';

/**
 * Back, close and cancel across the three solutions. Each assertion goes through what the user sees — the `active`
 * attribute on the activity host and the `open` state of the `<dialog>` — rather than `getCurrentActivity()` alone.
 */

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

const openUrlSource = async (root: HTMLElement) => {
  await page.getByTestId('uc-start-from').getByText('From link', { exact: true }).click();
  await expectActivity(root, 'url');
};

describe('regular', () => {
  it('closes the dialog when start-from is cancelled', async () => {
    const { root, api } = await renderSolution('regular');
    api.initFlow();
    await expectModal(root, 'start-from', 'open');

    await page.getByTestId('uc-start-from').getByText('Cancel', { exact: true }).click();

    await expectModal(root, 'start-from', 'closed');
    expect(api.getCurrentActivity()).toBe(null);
  });

  it('goes back to start-from from the url source, keeping a dialog open', async () => {
    const { root, api } = await renderSolution('regular');
    api.initFlow();
    await expectModal(root, 'start-from', 'open');
    await openUrlSource(root);

    await page.getByTestId('uc-url-source').getByRole('button', { name: 'Back' }).click();

    await expectActivity(root, 'start-from');
    await expectModal(root, 'start-from', 'open');
    expect(api.getCurrentActivity()).toBe('start-from');
  });

  it('closes everything from the url source close button', async () => {
    const { root, api } = await renderSolution('regular');
    api.initFlow();
    await expectModal(root, 'start-from', 'open');
    await openUrlSource(root);

    await page.getByTestId('uc-url-source').getByRole('button', { name: 'Close' }).click();

    await expectModal(root, 'start-from', 'closed');
    await expect.poll(() => api.getCurrentActivity()).toBe(null);
  });

  it('closes the upload list from its close button', async () => {
    const { root, api } = await renderSolution('regular');
    api.addFileFromObject(IMAGE.PIXEL);
    api.initFlow();
    await expectModal(root, 'upload-list', 'open');

    await page.getByTestId('uc-activity-header--close').click();

    await expectModal(root, 'upload-list', 'closed');
    await expect.poll(() => api.getCurrentActivity()).toBe(null);
  });

  it('closes on Escape', async () => {
    const { root, api } = await renderSolution('regular');
    api.initFlow();
    await expectModal(root, 'start-from', 'open');

    // The native <dialog> handles Escape itself and fires `close`, which Modal listens for.
    await userEvent.keyboard('{Escape}');

    await expectModal(root, 'start-from', 'closed');
    await expect.poll(() => api.getCurrentActivity()).toBe(null);
  });

  it('closes when the backdrop is clicked', async () => {
    const { root, api } = await renderSolution('regular');
    api.initFlow();
    await expectModal(root, 'start-from', 'open');

    const dialog = modalDialog(root, 'start-from') as HTMLDialogElement;
    dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    dialog.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    await expectModal(root, 'start-from', 'closed');
    expect(api.getCurrentActivity()).toBe(null);
  });

  it('stays open when a drag starts inside the dialog and ends on the backdrop', async () => {
    const { root, api } = await renderSolution('regular');
    api.initFlow();
    await expectModal(root, 'start-from', 'open');

    // Modal only closes when mousedown and mouseup both land on the dialog element itself, so releasing a selection
    // drag over the backdrop must not dismiss it (Modal.ts:52).
    const dialog = modalDialog(root, 'start-from') as HTMLDialogElement;
    const inside = page.getByTestId('uc-start-from').element();
    inside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    dialog.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    await delay(200);
    expect(dialog.open).toBe(true);
    expect(api.getCurrentActivity()).toBe('start-from');
  });
});

describe('minimal', () => {
  it('returns to the upload list when the start-from modal is cancelled', async () => {
    const { root, api } = await renderSolution('minimal');
    api.addFileFromObject(IMAGE.PIXEL);
    await expectActivity(root, 'upload-list');

    // Not `initFlow()`: with files already in the collection that routes to the upload list, so the modal has to be
    // opened explicitly to get back to start-from.
    api.setCurrentActivity('start-from');
    api.setModalState(true);
    await expectModal(root, 'start-from', 'open');

    await page.getByTestId('uc-start-from').getByText('Cancel', { exact: true }).click();

    await expectModal(root, 'start-from', 'closed');
    await expectActivity(root, 'upload-list');
    expect(api.getCurrentActivity()).toBe('upload-list');
  });

  it('falls back to the init activity when the list is empty', async () => {
    const { root, api } = await renderSolution('minimal');
    api.initFlow();
    await expectModal(root, 'start-from', 'open');

    await page.getByTestId('uc-start-from').getByText('Cancel', { exact: true }).click();

    await expectModal(root, 'start-from', 'closed');
    await expect.poll(() => api.getCurrentActivity()).toBe('start-from');
  });
});

describe('inline', () => {
  it('hides the cancel button with nothing to go back to', async () => {
    const { root } = await renderSolution('inline');
    await expectActivity(root, 'start-from');

    const cancel = root.querySelector('.uc-cancel-btn') as HTMLButtonElement;
    expect(cancel.hidden).toBe(true);
  });

  it('keeps cancel hidden after coming back to an empty start-from', async () => {
    const { root } = await renderSolution('inline');
    await expectActivity(root, 'start-from');
    await openUrlSource(root);

    await page.getByTestId('uc-url-source').getByRole('button', { name: 'Back' }).click();
    await expectActivity(root, 'start-from');

    // Correct here: history is back at start-from and the collection is empty, so cancelling would have nowhere to
    // go (`_couldHistoryBack` and `_couldShowList` are both false — FileUploaderInline.ts:52).
    await delay(200);
    expect((root.querySelector('.uc-cancel-btn') as HTMLButtonElement).hidden).toBe(true);
  });

  // QUIRK(inline): `_couldCancel` is recomputed only inside the `*history` subscription
  // (FileUploaderInline.ts:96), so it does not pick up that the collection now has files. Going to start-from via
  // "Add more" therefore leaves the cancel button hidden even though cancelling would work — the user is on the
  // source picker with files already uploaded and no visible way back to the list. The handler itself is fine:
  // invoked directly it routes to `upload-list`. Pinned as current behaviour, not endorsed.
  it('hides cancel after "Add more" even though the action would work', async () => {
    const { root, api } = await renderSolution('inline');
    await expectActivity(root, 'start-from');
    api.addFileFromObject(IMAGE.PIXEL);
    await expectActivity(root, 'upload-list');

    (within(root).getByTestId('uc-upload-list--add-more').element() as HTMLButtonElement).click();
    await expectActivity(root, 'start-from');

    const cancel = root.querySelector('.uc-cancel-btn') as HTMLButtonElement;
    await delay(200);
    expect(cancel.hidden).toBe(true);

    cancel.click();
    await expectActivity(root, 'upload-list');
    expect(api.getCurrentActivity()).toBe('upload-list');
  });
});
