import { describe, expect, it, test } from 'vitest';
import { commands, userEvent } from 'vitest/browser';
import { TEST_IMAGE_URL } from '~/tests/utils/constants';
import '~/types/jsx';
import { openModal, renderSolution, within } from '~/tests/utils/render-solution';

describe('uc-file-uploader-regular', () => {
  describe('upload button', () => {
    it('renders', async () => {
      const { root } = await renderSolution('regular');

      await expect.element(within(root).getByText('Upload files', { exact: true })).toBeVisible();
    });
  });

  describe('start-from modal', () => {
    it('opens on upload button click', async () => {
      const { root } = await renderSolution('regular');

      await within(root).getByText('Upload files', { exact: true }).click();

      await expect.element(within(root).getByTestId('uc-start-from')).toBeVisible();
    });

    it('offers the default sources', async () => {
      const { root } = await renderSolution('regular');
      await openModal(root);
      const startFrom = within(root).getByTestId('uc-start-from');

      await expect.element(startFrom.getByText('From device', { exact: true })).toBeVisible();
      await expect.element(startFrom.getByText('From link', { exact: true })).toBeVisible();
      await expect.element(startFrom.getByText('Camera', { exact: true })).toBeVisible();
      await expect.element(startFrom.getByText('Dropbox', { exact: true })).toBeVisible();
      await expect.element(startFrom.getByText('Google Drive', { exact: true })).toBeVisible();
    });

    it('shows the copyright', async () => {
      const { root } = await renderSolution('regular');
      await openModal(root);

      const startFrom = within(root).getByTestId('uc-start-from');
      await expect.element(startFrom.getByText('Powered by Uploadcare', { exact: true })).toBeVisible();
    });

    it('shows a cancel button', async () => {
      const { root } = await renderSolution('regular');
      await openModal(root);

      const startFrom = within(root).getByTestId('uc-start-from');
      await expect.element(startFrom.getByText('Cancel', { exact: true })).toBeVisible();
    });
  });

  describe('adding files to the upload list', () => {
    test('from device', async () => {
      const { root } = await renderSolution('regular');
      await openModal(root);
      const startFrom = within(root).getByTestId('uc-start-from');
      const uploadList = within(root).getByTestId('uc-upload-list');

      commands.waitFileChooserAndUpload(['../fixtures/test_image.jpeg']);

      await startFrom.getByText('From device', { exact: true }).click();

      await expect.element(startFrom).not.toBeVisible();
      await expect.element(uploadList).toBeVisible();

      await expect.element(within(root).getByText('test_image.jpeg')).toBeVisible();
      await expect.element(within(root).getByText('1 file uploaded')).toBeVisible();
    });

    test('from link', async () => {
      const { root } = await renderSolution('regular');
      await openModal(root);
      const startFrom = within(root).getByTestId('uc-start-from');
      const uploadList = within(root).getByTestId('uc-upload-list');
      const urlSource = within(root).getByTestId('uc-url-source');

      await startFrom.getByText('From link').click();
      await expect.element(startFrom).not.toBeVisible();
      await expect.element(urlSource).toBeVisible();

      const urlInput = urlSource.getByPlaceholder('https://');
      await userEvent.fill(urlInput, TEST_IMAGE_URL);
      await userEvent.keyboard('{Enter}');

      await expect.element(uploadList).toBeVisible();
      await expect.element(within(root).getByText('prithiviraj-a-fa7Stge3YXs-unsplash.jpg')).toBeVisible();
      await expect.element(within(root).getByText('1 file uploaded')).toBeVisible();
    });

    test('from camera', async () => {
      const { root } = await renderSolution('regular');
      await openModal(root);
      const startFrom = within(root).getByTestId('uc-start-from');
      const uploadList = within(root).getByTestId('uc-upload-list');
      const cameraSource = within(root).getByTestId('uc-camera-source');

      await startFrom.getByText('Camera').click();
      await expect.element(startFrom).not.toBeVisible();
      await expect.element(cameraSource).toBeVisible();

      await userEvent.click(cameraSource.getByTestId('uc-camera-source--shot'));
      await userEvent.click(cameraSource.getByTestId('uc-camera-source--accept'));

      await expect.element(uploadList).toBeVisible();
      await expect.element(within(root).getByText(/camera-\d+\.jpeg/)).toBeVisible();
      await expect.element(within(root).getByText('1 file uploaded')).toBeVisible();
    });
  });
});
