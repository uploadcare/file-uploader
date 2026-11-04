import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { EventPayload } from '@/index.js';
import { modalDialog, openModal, renderSolution } from '../utils/render-solution';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

const outside: HTMLElement[] = [];
afterEach(() => {
  for (const el of outside) el.remove();
  outside.length = 0;
});

/** A button on the page, outside the uploader, kept clear of where the dialog renders. */
const appendOutsideButton = () => {
  const button = document.createElement('button');
  button.textContent = 'Outside';
  button.style.cssText = 'position: fixed; bottom: 0; left: 0; z-index: 2147483647;';
  document.body.append(button);
  outside.push(button);
  return button;
};

describe('modalPresentation="inline"', () => {
  it('opens the dialog in the page, not the top layer, and closes it on an outside click', async () => {
    const { root, provider } = await renderSolution('regular', { modalPresentation: 'inline' });
    const button = appendOutsideButton();
    const onOutsideClick = vi.fn();
    button.addEventListener('click', onOutsideClick);
    const onModalClose = vi.fn<(e: CustomEvent<EventPayload['modal-close']>) => void>();
    provider.addEventListener('modal-close', onModalClose);

    await openModal(root);
    const dialog = modalDialog(root, 'start-from')!;
    expect(dialog.open).toBe(true);
    expect(dialog.matches(':modal')).toBe(false);

    // A click inside the dialog keeps it open (inside its rounded corner, clear of the source buttons).
    await page.elementLocator(dialog).click({ position: { x: 20, y: 20 } });
    expect(dialog.open).toBe(true);

    // The page stays interactive, and the click outside closes the modal through the router.
    await page.elementLocator(button).click();
    expect(onOutsideClick).toHaveBeenCalledOnce();
    await expect.poll(() => onModalClose.mock.calls.length).toBe(1);
    await expect.poll(() => dialog.open).toBe(false);
  });

  it('closes on Escape', async () => {
    const { root, provider } = await renderSolution('regular', { modalPresentation: 'inline' });
    const onModalClose = vi.fn();
    provider.addEventListener('modal-close', onModalClose);

    await openModal(root);
    const dialog = modalDialog(root, 'start-from')!;
    expect(dialog.matches(':modal')).toBe(false);

    await userEvent.keyboard('{Escape}');
    await expect.poll(() => onModalClose.mock.calls.length).toBe(1);
    await expect.poll(() => dialog.open).toBe(false);
  });

  it('applies a runtime change on the next show', async () => {
    const { root, config, api } = await renderSolution('regular');

    await openModal(root);
    expect(modalDialog(root, 'start-from')!.matches(':modal')).toBe(true);
    api.setModalState(false);
    await expect.poll(() => modalDialog(root, 'start-from')!.open).toBe(false);

    config.modalPresentation = 'inline';
    await openModal(root);
    const dialog = modalDialog(root, 'start-from')!;
    expect(dialog.open).toBe(true);
    expect(dialog.matches(':modal')).toBe(false);
  });
});

describe('modalPresentation default', () => {
  it('opens the dialog as a modal', async () => {
    const { root } = await renderSolution('regular');

    await openModal(root);
    const dialog = modalDialog(root, 'start-from')!;
    expect(dialog.open).toBe(true);
    expect(dialog.matches(':modal')).toBe(true);
  });
});
