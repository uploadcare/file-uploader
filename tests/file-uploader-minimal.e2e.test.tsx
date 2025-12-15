import { commands, page, userEvent } from '@vitest/browser/context';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import '../types/jsx';
import fi from '@/locales/file-uploader/fi';
// biome-ignore lint/correctness/noUnusedImports: Used in JSX
import { renderer } from './utils/test-renderer';

beforeAll(async () => {
  // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
  // @ts-ignore
  await import('@/solutions/file-uploader/minimal/index.css');
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(() => {
  const ctxName = `test-${Math.random().toString(36).slice(2)}`;
  page.render(
    <>
      <uc-file-uploader-minimal ctx-name={ctxName}></uc-file-uploader-minimal>
      <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
});

describe('File uploader minimal', () => {
  describe('Upload button', () => {
    it('should be rendered', async () => {
      await expect.element(page.getByText('Choose file', { exact: true })).toBeVisible();
    });

    it('should open file dialog on click', async () => {
      await page.getByText('Choose file', { exact: true }).click();
      const startFrom = page.getByTestId('uc-start-from');
      await expect(startFrom).toBeDefined();
    });

    it('should drag and drop file', async () => {
      const fileUploader = page.getByTestId('uc-file-uploader-minimal');
      const copyright = page.getByText('Powered by Uploadcare', { exact: true });

      const uploadList = page.getByTestId('uc-upload-list');

      await userEvent.dragAndDrop(copyright, fileUploader);

      await expect.element(uploadList).toBeVisible();
    });

    it('should open cloud image editor modal on edit button click', async () => {
      await page.getByText('Choose file', { exact: true }).click();
      const startFrom = page.getByTestId('uc-start-from');
      const uploadList = page.getByTestId('uc-upload-list');

      commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg']);

      await startFrom.getByText('From device', { exact: true }).click();

      await expect.element(uploadList).toBeVisible();
      const file = page.getByTestId('uc-file-item');

      const editButton = file.getByTestId('uc-file-item--edit');
      await userEvent.click(editButton);

      const modal = page.getByTestId('uc-cloud-image-editor-activity');
      await expect.element(modal).toBeVisible();
    });
  });
});
