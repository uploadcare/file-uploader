import { describe, expect, it, onTestFinished } from 'vitest';
import { userEvent } from 'vitest/browser';
import { IMAGE } from '~/tests/fixtures/files';
import { expectActivity, expectModal, modalDialog, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * Back, close and cancel across the three solutions. Each assertion goes through what the user sees — the `active`
 * attribute on the activity host and the `open` state of the `<dialog>` — rather than `getCurrentActivity()` alone.
 */

const openUrlSource = async (root: HTMLElement) => {
  await within(root).getByTestId('uc-start-from').getByText('From link', { exact: true }).click();
  await expectActivity(root, 'url');
};

/** Inline's own Cancel button on start-from. Found even while hidden, since several tests assert that it is. */
const inlineCancel = (root: HTMLElement) =>
  within(root).getByTestId('uc-start-from').getByRole('button', { name: 'Cancel', includeHidden: true });

/**
 * Every change to `element.hidden` from now on, as 'shown'/'hidden', with the test's own markers mixed in so a log can
 * say what happened before which step.
 */
const logHidden = (element: HTMLElement) => {
  const log: string[] = [];
  const observer = new MutationObserver(() => log.push(element.hidden ? 'hidden' : 'shown'));
  observer.observe(element, { attributes: true, attributeFilter: ['hidden'] });
  onTestFinished(() => observer.disconnect());
  return { log, mark: (step: string) => log.push(step) };
};

describe('regular', () => {
  it('closes the dialog when start-from is cancelled', async () => {
    const { root, api } = await renderSolution('regular');
    api.initFlow();
    await expectModal(root, 'start-from', 'open');

    await within(root).getByTestId('uc-start-from').getByText('Cancel', { exact: true }).click();

    await expectModal(root, 'start-from', 'closed');
    expect(api.getCurrentActivity()).toBe(null);
  });

  it('goes back to start-from from the url source, keeping a dialog open', async () => {
    const { root, api } = await renderSolution('regular');
    api.initFlow();
    await expectModal(root, 'start-from', 'open');
    await openUrlSource(root);

    await within(root).getByTestId('uc-url-source').getByRole('button', { name: 'Back' }).click();

    await expectActivity(root, 'start-from');
    await expectModal(root, 'start-from', 'open');
    expect(api.getCurrentActivity()).toBe('start-from');
  });

  it('closes everything from the url source close button', async () => {
    const { root, api } = await renderSolution('regular');
    api.initFlow();
    await expectModal(root, 'start-from', 'open');
    await openUrlSource(root);

    await within(root).getByTestId('uc-url-source').getByRole('button', { name: 'Close' }).click();

    await expectModal(root, 'start-from', 'closed');
    await expect.poll(() => api.getCurrentActivity()).toBe(null);
  });

  it('closes the upload list from its close button', async () => {
    const { root, api } = await renderSolution('regular');
    api.addFileFromObject(IMAGE.PIXEL);
    api.initFlow();
    await expectModal(root, 'upload-list', 'open');

    await within(root).getByTestId('uc-activity-header--close').click();

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
    const inside = within(root).getByTestId('uc-start-from').element();
    inside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    dialog.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    // The mouseup handler decides on the spot, so the dialog is still open now; the sentinel below closes it through
    // the same handlers, which shows the release above reached them.
    expect(dialog.open).toBe(true);
    expect(api.getCurrentActivity()).toBe('start-from');

    dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    dialog.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await expectModal(root, 'start-from', 'closed');
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

    await within(root).getByTestId('uc-start-from').getByText('Cancel', { exact: true }).click();

    await expectModal(root, 'start-from', 'closed');
    await expectActivity(root, 'upload-list');
    expect(api.getCurrentActivity()).toBe('upload-list');
  });

  it('falls back to the init activity when the list is empty', async () => {
    const { root, api } = await renderSolution('minimal');
    api.initFlow();
    await expectModal(root, 'start-from', 'open');

    await within(root).getByTestId('uc-start-from').getByText('Cancel', { exact: true }).click();

    await expectModal(root, 'start-from', 'closed');
    await expect.poll(() => api.getCurrentActivity()).toBe('start-from');
  });
});

describe('inline', () => {
  it('hides the cancel button with nothing to go back to', async () => {
    const { root } = await renderSolution('inline');
    await expectActivity(root, 'start-from');

    await expect.element(inlineCancel(root)).not.toBeVisible();
  });

  it('keeps cancel hidden after coming back to an empty start-from', async () => {
    const { root, api } = await renderSolution('inline');
    await expectActivity(root, 'start-from');
    await openUrlSource(root);

    await within(root).getByTestId('uc-url-source').getByRole('button', { name: 'Back' }).click();
    await expectActivity(root, 'start-from');

    // Correct here: history is back at start-from and the collection is empty, so cancelling would have nowhere to
    // go (`_couldHistoryBack` and `_couldShowList` are both false — FileUploaderInline.ts:52).
    const cancel = inlineCancel(root);
    await expect.element(cancel).not.toBeVisible();
    // The sentinel: with a file in the list, the next history reset (the activity going to null) recomputes the
    // button and shows it. Nothing may have shown it before the file arrived.
    const hidden = logHidden(cancel.element() as HTMLElement);
    hidden.mark('file added');
    api.addFileFromObject(IMAGE.PIXEL);
    await expectActivity(root, 'upload-list');
    api.setModalState(false);
    await expect.poll(() => hidden.log).toEqual(['file added', 'shown']);
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

    const cancel = inlineCancel(root);
    await expect.element(cancel).not.toBeVisible();
    const hidden = logHidden(cancel.element() as HTMLElement);

    // Clicked through the DOM on purpose: the button is hidden, and this checks that its handler would still work.
    (cancel.element() as HTMLButtonElement).click();
    await expectActivity(root, 'upload-list');
    expect(api.getCurrentActivity()).toBe('upload-list');

    // The sentinel: a history reset (the activity going to null) is what does recompute the button, and with files in
    // the list it shows it. Nothing may have shown it before.
    hidden.mark('history reset');
    api.setModalState(false);
    await expect.poll(() => hidden.log).toEqual(['history reset', 'shown']);
  });
});
