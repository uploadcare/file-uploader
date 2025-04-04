import { commands, page, userEvent } from '@vitest/browser/context';
import { beforeAll, beforeEach, describe, expect, it, test } from 'vitest';
import { renderer } from './utils/test-renderer';
import '../types/jsx';

beforeAll(async () => {
  await import('@/solutions/file-uploader/regular/index.css');
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(async () => {
  page.render(
    <>
      <uc-file-uploader-regular ctx-name="my-uploader"></uc-file-uploader-regular>
      <uc-config ctx-name="my-uploader" pubkey="demopublickey"></uc-config>
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
      const startFrom = page.elementLocator(document.querySelector('uc-start-from')!);
      await expect.element(startFrom).toBeVisible();
    });

    it('should have default sources', async () => {
      const startFrom = page.elementLocator(document.querySelector('uc-start-from')!);

      await expect.element(startFrom.getByText('From device', { exact: true })).toBeVisible();
      await expect.element(startFrom.getByText('From link', { exact: true })).toBeVisible();
      await expect.element(startFrom.getByText('Camera', { exact: true })).toBeVisible();
      await expect.element(startFrom.getByText('Dropbox', { exact: true })).toBeVisible();
      await expect.element(startFrom.getByText('Google Drive', { exact: true })).toBeVisible();
    });

    it('should have copyright', async () => {
      const startFrom = page.elementLocator(document.querySelector('uc-start-from')!);
      await expect.element(startFrom.getByText('Powered by Uploadcare', { exact: true })).toBeVisible();
    });

    it('should have cancel button', async () => {
      const startFrom = page.elementLocator(document.querySelector('uc-start-from')!);
      await expect.element(startFrom.getByText('Cancel', { exact: true })).toBeVisible();
    });

    it('should close modal on cancel button click', async () => {
      const startFrom = page.elementLocator(document.querySelector('uc-start-from')!);
      await startFrom.getByText('Cancel', { exact: true }).click();
      await expect.element(startFrom).not.toBeVisible();
    });

    it('should close modal on overlay click', async () => {
      await page.getByText('Upload files', { exact: true }).click();
      const startFrom = page.elementLocator(document.querySelector('uc-start-from')!);
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
      const startFrom = page.elementLocator(document.querySelector('uc-start-from')!);
      commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg']);

      await startFrom.getByText('From device', { exact: true }).click();
      await expect.element(startFrom).not.toBeVisible();

      const uploadList = document.querySelector('uc-upload-list')!;
      await expect.element(uploadList).toBeVisible();

      await expect.element(page.getByText('test_image.jpeg')).toBeVisible();
      await expect.element(page.getByText('1 file uploaded')).toBeVisible();
    });
  });
});
