import { expect } from 'vitest';
import { within } from '~/tests/utils/render-solution';

/** Resolves on the next `change` the cloud image editor emits. Register before the action that triggers it. */
const waitForEditorChange = (root: HTMLElement) =>
  new Promise<void>((resolve) => {
    root.querySelector('uc-cloud-image-editor')?.addEventListener('change', () => resolve(), { once: true });
  });

/** Opens the editor for the first file, mirrors the image, applies, and waits for the modal to close. */
export async function applyMirror(root: HTMLElement): Promise<void> {
  const editButton = within(root).getByLabelText('Edit', { exact: true });
  await expect.element(editButton).toBeVisible();
  await editButton.click();

  // Editor is in DOM once mirror button is visible
  const mirrorButton = within(root).getByLabelText('Apply mirror operation', { exact: true });
  await expect.element(mirrorButton).toBeVisible();
  // Wait for initial crop to commit (image loaded + 300ms debounce)
  await waitForEditorChange(root);

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
