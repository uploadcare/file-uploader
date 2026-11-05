import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { clickSource, modalDialog, openModal, renderSolution, within } from '../utils/render-solution';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('initial focus when a modal opens', () => {
  it('lands on the first source button on start-from, as in 1.35, not on the drop area', async () => {
    const { root } = await renderSolution('regular');

    await openModal(root);

    const fromDevice = within(root).getByTestId('uc-start-from').getByRole('button', { name: 'From device' }).element();
    await expect.poll(() => document.activeElement).toBe(fromDevice);
  });

  it('lands on the first source button when initFlow() opens start-from', async () => {
    const { root, api } = await renderSolution('regular');

    api.initFlow();

    const fromDevice = within(root).getByTestId('uc-start-from').getByRole('button', { name: 'From device' });
    await expect.element(fromDevice).toBeVisible();
    await expect.poll(() => document.activeElement).toBe(fromDevice.element());
  });

  it('skips the drop area when the deprecated setCurrentActivity + setModalState open start-from', async () => {
    await page.viewport(1000, 760);
    const { root, api } = await renderSolution('regular');

    api.setCurrentActivity('start-from');
    api.setModalState(true);

    const fromDevice = within(root).getByTestId('uc-start-from').getByRole('button', { name: 'From device' });
    await expect.element(fromDevice).toBeVisible();
    await expect.poll(() => document.activeElement).toBe(fromDevice.element());
  });

  it('lands on the Back button on the camera screen, as in 1.35, not on the dialog', async () => {
    const { root } = await renderSolution('regular', { sourceList: 'local, camera' });

    await clickSource(root, 'Camera');

    const dialog = modalDialog(root, 'camera')!;
    const back = within(dialog).getByRole('button', { name: 'Back' }).element();
    await expect.poll(() => document.activeElement).toBe(back);
  });
});
