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
      <uc-file-uploader-regular dynamic ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
});

describe('SmartBtn upload list behavior', () => {
  describe('with dynamic mode (SmartBtn active)', () => {
    it('should NOT open upload list after file selection from system dialog', async () => {
      const smartBtn = page.getByTestId('uc-smart-btn');
      const uploadList = page.getByTestId('uc-upload-list');

      await expect.element(smartBtn).toBeVisible();

      commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg']);

      await smartBtn.click();

      await expect.element(uploadList).not.toBeVisible();
      await expect.element(smartBtn.getByText('1 file uploaded')).toBeVisible();
    });

    it('should open upload list when clicking SmartBtn after files are uploaded', async () => {
      const smartBtn = page.getByTestId('uc-smart-btn');
      const uploadList = page.getByTestId('uc-upload-list');

      await expect.element(smartBtn).toBeVisible();

      commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg']);
      await smartBtn.click();

      await smartBtn.click();
      await expect.element(uploadList).toBeVisible();
    });
  });
});
