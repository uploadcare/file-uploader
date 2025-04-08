import { commands, page, userEvent } from '@vitest/browser/context';
import { beforeAll, beforeEach, describe, expect, it, test } from 'vitest';
import { renderer } from './utils/test-renderer';
import '../types/jsx';
import { vi } from 'vitest';

beforeAll(async () => {
  await import('@/solutions/file-uploader/regular/index.css');
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(() => {
  const ctxName = `test-${Math.random().toString(36).slice(2)}`;
  page.render(
    <>
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
});

describe('File uploader regular', () => {
  describe('Upload button', () => {
    it('should be rendered', async () => {
      await expect.element(page.getByText('Upload files', { exact: true })).toBeVisible();
    });
  });

  describe('Modal: start from', async () => {
    it('should be opened on upload button click', async () => {
      await page.getByText('Upload files', { exact: true }).click();
      const startFrom = page.getByTestId('uc-start-from');
      await expect.element(startFrom).toBeVisible();
    });

    it('should have default sources', async () => {
      await page.getByText('Upload files', { exact: true }).click();
      const startFrom = page.getByTestId('uc-start-from');

      await expect.element(startFrom.getByText('From device', { exact: true })).toBeVisible();
      await expect.element(startFrom.getByText('From link', { exact: true })).toBeVisible();
      await expect.element(startFrom.getByText('Camera', { exact: true })).toBeVisible();
      await expect.element(startFrom.getByText('Dropbox', { exact: true })).toBeVisible();
      await expect.element(startFrom.getByText('Google Drive', { exact: true })).toBeVisible();
    });

    it('should have copyright', async () => {
      await page.getByText('Upload files', { exact: true }).click();

      const startFrom = page.getByTestId('uc-start-from');
      await expect.element(startFrom.getByText('Powered by Uploadcare', { exact: true })).toBeVisible();
    });

    it('should have cancel button', async () => {
      await page.getByText('Upload files', { exact: true }).click();

      const startFrom = page.getByTestId('uc-start-from');
      await expect.element(startFrom.getByText('Cancel', { exact: true })).toBeVisible();
    });

    it('should close modal on cancel button click', async () => {
      await page.getByText('Upload files', { exact: true }).click();

      const startFrom = page.getByTestId('uc-start-from');
      await startFrom.getByText('Cancel', { exact: true }).click();
      await expect.element(startFrom).not.toBeVisible();
    });

    it('should close modal on overlay click', async () => {
      await page.getByText('Upload files', { exact: true }).click();
      const startFrom = page.getByTestId('uc-start-from');
      await userEvent.click(document.body, {
        position: {
          x: 10,
          y: 10,
        },
      });
      await expect.element(startFrom).not.toBeVisible();
    });
  });

  describe('Add files to the upload list', () => {
    test('from device', async () => {
      await page.getByText('Upload files', { exact: true }).click();
      const startFrom = page.getByTestId('uc-start-from');
      const uploadList = page.getByTestId('uc-upload-list');

      commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg']);

      await startFrom.getByText('From device', { exact: true }).click();

      await expect.element(startFrom).not.toBeVisible();
      await expect.element(uploadList).toBeVisible();

      await expect.element(page.getByText('test_image.jpeg')).toBeVisible();
      await expect.element(page.getByText('1 file uploaded')).toBeVisible();
    });

    test('from link', async () => {
      await page.getByText('Upload files', { exact: true }).click();
      const startFrom = page.getByTestId('uc-start-from');
      const uploadList = page.getByTestId('uc-upload-list');
      const urlSource = page.getByTestId('uc-url-source');

      await expect.element(startFrom).toBeVisible();
      await startFrom.getByText('From link').click();
      await expect.element(startFrom).not.toBeVisible();
      await expect.element(urlSource).toBeVisible();

      const urlInput = urlSource.getByPlaceholder('https://');
      await userEvent.fill(
        urlInput,
        'https://images.unsplash.com/photo-1699102241946-45c5e1937d69?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&dl=prithiviraj-a-fa7Stge3YXs-unsplash.jpg&w=640',
      );
      await userEvent.keyboard('{Enter}');

      await expect.element(uploadList).toBeVisible();
      await expect.element(page.getByText('prithiviraj-a-fa7Stge3YXs-unsplash.jpg')).toBeVisible();
      await expect.element(page.getByText('1 file uploaded')).toBeVisible();
    });

    test('from camera', async () => {
      await page.getByText('Upload files', { exact: true }).click();
      const startFrom = page.getByTestId('uc-start-from');
      const uploadList = page.getByTestId('uc-upload-list');
      const cameraSource = page.getByTestId('uc-camera-source');

      await expect.element(startFrom).toBeVisible();
      await startFrom.getByText('Camera').click();
      await expect.element(startFrom).not.toBeVisible();
      await expect.element(cameraSource).toBeVisible();

      const cameraButton = cameraSource.query()?.querySelector('button.uc-shot-btn')!;
      await expect.element(cameraButton).toBeVisible();
      await page.elementLocator(cameraButton).click();
      await cameraSource.getByText('Accept').click();

      await expect.element(uploadList).toBeVisible();
      await expect.element(page.getByText(/camera-\d+\.jpeg/)).toBeVisible();
      await expect.element(page.getByText('1 file uploaded')).toBeVisible();
    });
  });
});
