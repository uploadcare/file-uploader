import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { UploadCtxProvider } from '@/index';
import { TEST_IMAGE_URL } from './utils/constants';
import '../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(() => {
  const ctxName = `test-${Math.random().toString(36).slice(2)}`;
  page.render(
    <>
      <uc-file-uploader-minimal ctx-name={ctxName}></uc-file-uploader-minimal>
      <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );
});

describe('File uploader minimal', () => {
  describe('Upload button', () => {
    it('should be rendered', async () => {
      await expect.element(page.getByText('Choose files', { exact: true })).toBeVisible();
    });

    it('should open file dialog on click', async () => {
      await page.getByText('Choose files', { exact: true }).click();
      await expect.element(page.getByText('From device', { exact: true })).toBeVisible();
    });

    it('should drag and drop file', async () => {
      await expect.element(page.getByText('Choose files', { exact: true })).toBeVisible();

      const fileUploader = page.getByTestId('uc-file-uploader-minimal');
      const copyright = page.getByText('Powered by Uploadcare', { exact: true });

      const uploadList = page.getByTestId('uc-upload-list');

      await userEvent.dragAndDrop(copyright, fileUploader);

      await expect.element(uploadList).toBeVisible();
    });

    it('should open cloud image editor modal on edit button click', async () => {
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();

      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();

      await expect.poll(() => api.getOutputCollectionState().allEntries[0]?.cdnUrl, { timeout: 15000 }).toBeTruthy();

      const file = page.getByTestId('uc-file-item');
      await expect.element(file).toBeVisible();

      const editButton = file.getByRole('button', { name: 'Edit', exact: true });
      await expect.element(editButton).toBeVisible();
      await userEvent.click(editButton);

      const modal = page.getByTestId('uc-cloud-image-editor-activity');
      await expect.element(modal).toBeVisible();
    });
  });
});
