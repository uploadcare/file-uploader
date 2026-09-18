import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import type { Config } from '@/index';
import { renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * The regular solution with `dynamic-button` on: files picked from the system dialog upload behind the button instead
 * of opening the upload list, unless something needs the user's attention.
 */
const renderDynamic = async (configProps: Partial<Config> = {}) => {
  const rendered = await renderSolution('regular', { dynamicButtonViewMode: 'auto', ...configProps });
  // `dynamic-button` is a reactive Lit property on the solution root, not a config option, so it goes on `root`.
  rendered.root.setAttribute('dynamic-button', '');
  const dynamicBtn = within(rendered.root).getByTestId('uc-dynamic-btn');
  await expect.element(dynamicBtn).toBeVisible();
  return { ...rendered, dynamicBtn, uploadList: within(rendered.root).getByTestId('uc-upload-list') };
};

describe('upload list after picking files through the dynamic button', () => {
  it('stays closed and reports the upload on the button', async () => {
    const { dynamicBtn, uploadList } = await renderDynamic();

    commands.waitFileChooserAndUpload(['../fixtures/test_image.jpeg']);
    await dynamicBtn.click();

    await expect.element(uploadList).not.toBeVisible();
    await expect.element(dynamicBtn.getByText('1 file uploaded')).toBeVisible();
  });

  it('opens on a second click once files are uploaded', async () => {
    const { dynamicBtn, uploadList } = await renderDynamic();

    commands.waitFileChooserAndUpload(['../fixtures/test_image.jpeg']);
    await dynamicBtn.click();

    await dynamicBtn.click();
    await expect.element(uploadList).toBeVisible();
  });

  it('opens right away when upload confirmation is required', async () => {
    const { dynamicBtn, uploadList } = await renderDynamic({ confirmUpload: true });

    commands.waitFileChooserAndUpload(['../fixtures/test_image.jpeg']);
    await dynamicBtn.click();

    await expect.element(uploadList).toBeVisible();
    await expect.element(uploadList.getByText('test_image.jpeg')).toBeVisible();
    await expect.element(uploadList.getByText('Upload', { exact: true })).toBeVisible();
  });
});

describe('compact dynamic button with a single source', () => {
  it('activates the only source directly instead of showing a drop-down', async () => {
    const { root, dynamicBtn } = await renderDynamic({ dynamicButtonViewMode: 'compact', sourceList: 'local' });

    await expect.poll(() => within(root).getByTestId('uc-drop-down').query()).toBeNull();

    commands.waitFileChooserAndUpload(['../fixtures/test_image.jpeg']);
    await dynamicBtn.click();

    await expect.element(dynamicBtn.getByText('1 file uploaded')).toBeVisible();
  });
});
