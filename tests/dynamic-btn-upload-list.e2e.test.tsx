import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { commands, page } from 'vitest/browser';
import '../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(() => {
  const ctxName = `test-${Math.random().toString(36).slice(2)}`;
  page.render(
    <>
      <uc-file-uploader-regular dynamic-button ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
});

describe('DynamicBtn upload list behavior', () => {
  describe('with dynamic mode (DynamicBtn active)', () => {
    it('should NOT open upload list after file selection from system dialog', async () => {
      const dynamicBtn = page.getByTestId('uc-dynamic-btn');
      const uploadList = page.getByTestId('uc-upload-list');

      await expect.element(dynamicBtn).toBeVisible();

      commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg']);

      await dynamicBtn.click();

      await expect.element(uploadList).not.toBeVisible();
      await expect.element(dynamicBtn.getByText('1 file uploaded')).toBeVisible();
    });

    it('should open upload list when clicking DynamicBtn after files are uploaded', async () => {
      const dynamicBtn = page.getByTestId('uc-dynamic-btn');
      const uploadList = page.getByTestId('uc-upload-list');

      await expect.element(dynamicBtn).toBeVisible();

      commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg']);
      await dynamicBtn.click();

      await dynamicBtn.click();
      await expect.element(uploadList).toBeVisible();
    });

    it('should open upload list after file selection when upload confirmation is required', async () => {
      const config = document.querySelector('uc-config') as HTMLElement & { confirmUpload: boolean };
      config.confirmUpload = true;

      const dynamicBtn = page.getByTestId('uc-dynamic-btn');
      const uploadList = page.getByTestId('uc-upload-list');

      await expect.element(dynamicBtn).toBeVisible();

      commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg']);
      await dynamicBtn.click();

      await expect.element(uploadList).toBeVisible();
      await expect.element(uploadList.getByText('test_image.jpeg')).toBeVisible();
      await expect.element(uploadList.getByText('Upload', { exact: true })).toBeVisible();
    });
  });
});
