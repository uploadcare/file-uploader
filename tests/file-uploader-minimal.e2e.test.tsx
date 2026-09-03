import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { ConfigController } from '@/abstract/controllers/ConfigController';
import { RouterController } from '@/abstract/controllers/RouterController';
import type { Config, DropArea, FileUploaderMinimal, UploadCtxProvider } from '@/index';
import { ACTIVITY_TYPES } from '@/lit/activity-constants.js';
import { TEST_IMAGE_URL } from './utils/constants';
import { getCtxName } from './utils/getCtxName';
import { containerOf, hasCtx } from './utils/registry';
import { cleanup } from './utils/test-renderer';
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

    it('should show the upload list after a file is picked from the device dialog', async () => {
      await page.getByText('Choose files', { exact: true }).click();
      await page.getByText('From device', { exact: true }).click();

      // openSystemDialog() appends a hidden input and clicks it; the native dialog
      // never opens under test, so feed the input directly to fire its change handler.
      const fileInput = page.elementLocator(document.querySelector('[uploadcare-file-input]')!);
      await userEvent.upload(fileInput, new File(['regression'], 'regression.txt', { type: 'text/plain' }));

      await expect.element(page.getByTestId('uc-upload-list')).toBeVisible();
      await expect.element(page.getByTestId('uc-file-item')).toBeVisible();
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

/**
 * M9r Task 1 — coverage-first safety net ahead of the ChildBlock port of the
 * three solution blocks. Pins minimal-specific behavior the port could
 * plausibly change: standalone bootstrap/teardown, `router.navigationStrategy`
 * (background only for UPLOAD_LIST), the background-slot-follows-`*uploadList`
 * wiring, `confirmUpload` being forced to `false`, and the `multiple`-driven
 * button-text-key / grid `--uc-grid-col` / `_singleUpload` logic. Each test
 * renders its own isolated composition via `cleanup()` + `page.render(...)`,
 * overriding the file-level `beforeEach` default composition so it never
 * collides with it.
 */
describe('File uploader minimal — M9r solution-block safety net', () => {
  describe('Standalone bootstrap/teardown', () => {
    it('self-bootstraps its ctx from a bare config+solution composition, and tears it down on removal', async () => {
      cleanup();
      const ctxName = getCtxName();
      page.render(
        <>
          <uc-file-uploader-minimal ctx-name={ctxName}></uc-file-uploader-minimal>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        </>,
      );

      await expect.poll(() => hasCtx(ctxName)).toBe(true);

      cleanup();
      await expect.poll(() => hasCtx(ctxName)).toBe(false);
    });
  });

  describe('router.navigationStrategy', () => {
    it('resolves "background" only for UPLOAD_LIST, "foreground" for everything else', async () => {
      cleanup();
      const ctxName = getCtxName();
      page.render(
        <>
          <uc-file-uploader-minimal ctx-name={ctxName}></uc-file-uploader-minimal>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        </>,
      );
      await expect.poll(() => hasCtx(ctxName)).toBe(true);

      const router = containerOf(ctxName).get(RouterController);

      expect(router.navigationStrategy(ACTIVITY_TYPES.UPLOAD_LIST)).toBe('background');
      expect(router.navigationStrategy(ACTIVITY_TYPES.START_FROM)).toBe('foreground');
      expect(router.navigationStrategy(ACTIVITY_TYPES.CAMERA)).toBe('foreground');
      expect(router.navigationStrategy(ACTIVITY_TYPES.URL)).toBe('foreground');
    });
  });

  describe('Background slot follows *uploadList', () => {
    it('shows the upload list once files exist, and falls back to start-from once the list empties', async () => {
      cleanup();
      const ctxName = getCtxName();
      page.render(
        <>
          <uc-file-uploader-minimal ctx-name={ctxName}></uc-file-uploader-minimal>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
          <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
        </>,
      );
      await expect.poll(() => hasCtx(ctxName)).toBe(true);

      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();
      const uploadList = page.getByTestId('uc-upload-list');

      await expect.element(uploadList).not.toBeVisible();

      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();
      await expect.element(uploadList).toBeVisible();

      api.removeAllFiles();
      await expect.element(uploadList).not.toBeVisible();
    });
  });

  describe('confirmUpload is forced to false', () => {
    it('reverts confirmUpload back to false whenever config sets it truthy', async () => {
      cleanup();
      const ctxName = getCtxName();
      page.render(
        <>
          <uc-file-uploader-minimal ctx-name={ctxName}></uc-file-uploader-minimal>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        </>,
      );
      await expect.poll(() => hasCtx(ctxName)).toBe(true);

      const config = page.getByTestId('uc-config').query()! as Config;
      config.confirmUpload = true;

      await expect.poll(() => containerOf(ctxName).get(ConfigController).get('confirmUpload')).toBe(false);
    });
  });

  describe('multiple-driven button text + grid layout', () => {
    it('switches the button text key between choose-file / choose-files as multiple toggles', async () => {
      cleanup();
      const ctxName = getCtxName();
      page.render(
        <>
          <uc-file-uploader-minimal ctx-name={ctxName}></uc-file-uploader-minimal>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
          <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
        </>,
      );
      await expect.poll(() => hasCtx(ctxName)).toBe(true);

      // Drive `multiple` through the JS property (deterministic) rather than a
      // boolean attribute, whose default already resolves truthy.
      const config = page.getByTestId('uc-config').query()! as Config;
      config.multiple = false;
      await expect.element(page.getByText('Choose file', { exact: true })).toBeVisible();

      config.multiple = true;
      await expect.element(page.getByText('Choose files', { exact: true })).toBeVisible();
    });

    it('sets --uc-grid-col to 1 and single-uploads the drop area under filesViewMode: grid + multiple: false', async () => {
      cleanup();
      const ctxName = getCtxName();
      page.render(
        <>
          <uc-file-uploader-minimal ctx-name={ctxName}></uc-file-uploader-minimal>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
          <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
        </>,
      );
      await expect.poll(() => hasCtx(ctxName)).toBe(true);

      const config = page.getByTestId('uc-config').query()! as Config;
      config.filesViewMode = 'grid';
      config.multiple = false;

      const el = page.getByTestId('uc-file-uploader-minimal').query()! as FileUploaderMinimal;
      await expect.poll(() => el.style.getPropertyValue('--uc-grid-col')).toBe('1');

      const dropArea = page.getByTestId('uc-drop-area').nth(0).query()! as DropArea;
      await expect.poll(() => dropArea.single).toBe(true);

      config.multiple = true;
      await expect.poll(() => el.style.getPropertyValue('--uc-grid-col')).toBe('');
      await expect.poll(() => dropArea.single).toBe(false);
    });

    it('clears --uc-grid-col and un-single-uploads the drop area when leaving grid mode', async () => {
      cleanup();
      const ctxName = getCtxName();
      page.render(
        <>
          <uc-file-uploader-minimal ctx-name={ctxName}></uc-file-uploader-minimal>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
          <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
        </>,
      );
      await expect.poll(() => hasCtx(ctxName)).toBe(true);

      const config = page.getByTestId('uc-config').query()! as Config;
      config.filesViewMode = 'grid';
      config.multiple = false;

      const el = page.getByTestId('uc-file-uploader-minimal').query()! as FileUploaderMinimal;
      const dropArea = page.getByTestId('uc-drop-area').nth(0).query()! as DropArea;

      // Establish the grid + single-upload state first, so switching away from
      // grid below is a genuine regression pin, not vacuously true from a
      // default that was never anything else.
      await expect.poll(() => el.style.getPropertyValue('--uc-grid-col')).toBe('1');
      await expect.poll(() => dropArea.single).toBe(true);

      config.filesViewMode = 'list';

      await expect.poll(() => el.style.getPropertyValue('--uc-grid-col')).toBe('');
      await expect.poll(() => dropArea.single).toBe(false);
    });
  });
});
