import { expect } from 'vitest';
import { within } from '~/tests/utils/render-solution';

/**
 * Resolves on the next `change` a cloud image editor inside `root` emits, even one not mounted yet. Register before
 * the action that triggers it.
 */
const waitForEditorChange = (root: HTMLElement) =>
  new Promise<void>((resolve) => {
    const onChange = (event: Event) => {
      if ((event.target as Element).localName !== 'uc-cloud-image-editor') return;
      root.removeEventListener('change', onChange, true);
      resolve();
    };
    root.addEventListener('change', onChange, true);
  });

/** Opens the editor for the first file, mirrors the image, applies, and waits for the modal to close. */
export async function applyMirror(root: HTMLElement): Promise<void> {
  const editButton = within(root).getByLabelText('Edit', { exact: true });
  await expect.element(editButton).toBeVisible();
  // The editor reports its first `change` once the image has loaded: one per edit, so wait for it from the start.
  const loaded = waitForEditorChange(root);
  await editButton.click();

  // Editor is in DOM once mirror button is visible
  const mirrorButton = within(root).getByLabelText('Apply mirror operation', { exact: true });
  await expect.element(mirrorButton).toBeVisible();
  await loaded;

  // Register before click to avoid missing the event
  const changeAfterMirror = waitForEditorChange(root);
  await mirrorButton.click();
  await changeAfterMirror;

  const applyButton = within(root).getByRole('button', { name: /apply/i });
  await expect.element(applyButton).toBeEnabled();
  await applyButton.click();

  // Wait for modal to close before next cycle
  await expect.element(within(root).getByLabelText('Edit', { exact: true })).toBeVisible();
}
