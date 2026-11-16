import { beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { clickSource, modalDialog, openModal, renderSolution, within } from '../utils/render-solution';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('initial focus when a modal opens', () => {
  /** The dialog's first control: the drop area is a button, ahead of the sources. */
  const dropArea = (root: HTMLElement) => root.querySelector<HTMLElement>('uc-start-from uc-drop-area');
  const fromDevice = (root: HTMLElement) =>
    within(root).getByTestId('uc-start-from').getByRole('button', { name: 'From device' }).element();
  // Wide enough for start-from to show its drop area (the default 414px viewport hides it).
  const wide = async () => {
    await page.viewport(1000, 760);
    onTestFinished(() => page.viewport(414, 896));
  };

  it('lands on the drop area on start-from, and Tab goes on to the first source', async () => {
    await wide();
    const { root } = await renderSolution('regular');

    await openModal(root);

    await expect.poll(() => document.activeElement).toBe(dropArea(root));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(fromDevice(root));
  });

  it('lands on the first source where start-from shows no drop area', async () => {
    const { root } = await renderSolution('regular');

    await openModal(root);

    await expect.poll(() => document.activeElement).toBe(fromDevice(root));
  });

  it('lands on the drop area when initFlow() opens start-from', async () => {
    await wide();
    const { root, api } = await renderSolution('regular');

    api.initFlow();

    await expect.poll(() => dropArea(root)?.checkVisibility()).toBe(true);
    await expect.poll(() => document.activeElement).toBe(dropArea(root));
  });

  it('lands on the drop area when the deprecated setCurrentActivity + setModalState open start-from', async () => {
    await wide();
    const { root, api } = await renderSolution('regular');

    api.setCurrentActivity('start-from');
    api.setModalState(true);

    await expect.poll(() => dropArea(root)?.checkVisibility()).toBe(true);
    await expect.poll(() => document.activeElement).toBe(dropArea(root));
  });

  it('lands on the Back button on the camera screen, whose controls render after the dialog opens', async () => {
    const { root } = await renderSolution('regular', { sourceList: 'local, camera' });

    await clickSource(root, 'Camera');

    const dialog = modalDialog(root, 'camera')!;
    const back = within(dialog).getByRole('button', { name: 'Back' }).element();
    await expect.poll(() => document.activeElement).toBe(back);
  });
});
