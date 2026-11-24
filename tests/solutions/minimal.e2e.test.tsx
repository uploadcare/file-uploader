import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { UploaderPublicApi } from '@/abstract/UploaderPublicApi';
import type { DropArea } from '@/index';
import { delay } from '@/utils/delay';
import { TEST_IMAGE_URL } from '~/tests/utils/constants';
import '~/types/jsx';
import { IMAGE, testFile } from '~/tests/fixtures/files';
import { expectActivity, expectModal, renderSolution, within } from '~/tests/utils/render-solution';

describe('uc-file-uploader-minimal', () => {
  it('renders the choose-files button', async () => {
    const { root } = await renderSolution('minimal');

    await expect.element(within(root).getByText('Choose files', { exact: true })).toBeVisible();
  });

  it('opens start-from on click', async () => {
    const { root } = await renderSolution('minimal');

    await within(root).getByText('Choose files', { exact: true }).click();

    await expect.element(within(root).getByText('From device', { exact: true })).toBeVisible();
  });

  it('accepts a drag and drop onto the uploader', async () => {
    const { root } = await renderSolution('minimal');
    await expect.element(within(root).getByText('Choose files', { exact: true })).toBeVisible();

    const copyright = within(root).getByText('Powered by Uploadcare', { exact: true });
    await userEvent.dragAndDrop(copyright, within(root));

    await expect.element(within(root).getByTestId('uc-upload-list')).toBeVisible();
  });

  it('shows the upload list after a file is picked from the device dialog', async () => {
    const { root } = await renderSolution('minimal');
    await within(root).getByText('Choose files', { exact: true }).click();
    await within(root).getByText('From device', { exact: true }).click();

    // openSystemDialog() appends a hidden input and clicks it; the native dialog
    // never opens under test, so feed the input directly to fire its change handler.
    // The input carries no test id and is appended outside the uploader, hence the document query.
    const fileInput = page.elementLocator(document.querySelector('[uploadcare-file-input]')!);
    await userEvent.upload(fileInput, testFile('regression.txt', 'text/plain'));

    await expect.element(within(root).getByTestId('uc-upload-list')).toBeVisible();
    await expect.element(within(root).getByTestId('uc-file-item')).toBeVisible();
  });

  it('opens the cloud image editor from the edit button', async () => {
    const { root, api } = await renderSolution('minimal');

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    await expect.poll(() => api.getOutputCollectionState().allEntries[0]?.cdnUrl, { timeout: 15000 }).toBeTruthy();

    const file = within(root).getByTestId('uc-file-item');
    await expect.element(file).toBeVisible();

    const editButton = file.getByRole('button', { name: 'Edit', exact: true });
    await expect.element(editButton).toBeVisible();
    await userEvent.click(editButton);

    await expect.element(within(root).getByTestId('uc-cloud-image-editor-activity')).toBeVisible();
  });

  it('shows the upload list in place while it has files, and start-from once it empties', async () => {
    const { root, api } = await renderSolution('minimal');
    const uploadList = within(root).getByTestId('uc-upload-list');
    await expect.element(uploadList).not.toBeVisible();

    api.addFileFromObject(IMAGE.PIXEL);
    api.initFlow();
    await expect.element(uploadList).toBeVisible();
    expect(uploadList.element().closest('dialog')).toBeNull();

    api.removeAllFiles();
    await expect.element(uploadList).not.toBeVisible();
  });

  // As in v1, where a non-empty upload list made it the current activity and that closed every modal.
  it('closes an open source modal when files are added through the API', async () => {
    const { root, api } = await renderSolution('minimal');
    api.navigate('url');
    await expectModal(root, 'url', 'open');
    const modalClose = vi.fn();
    onTestFinished(api.on('modal-close', modalClose));

    api.addFileFromObject(IMAGE.PIXEL);

    await expectModal(root, 'url', 'closed');
    expect(api.getCurrentActivity()).toBe('upload-list');
    expect(modalClose).toHaveBeenCalledWith({ modalId: 'url', hasActiveModals: false });
  });

  // As in v1 and api.mdx: an empty upload list leaves the uploader on its start screen, the in-place trigger.
  it.each([
    ['setCurrentActivity', (api: UploaderPublicApi) => api.setCurrentActivity('upload-list')],
    ['navigate', (api: UploaderPublicApi) => api.navigate('upload-list')],
  ])('closes the open modal on %s("upload-list") with an empty list', async (_, toUploadList) => {
    const { root, api } = await renderSolution('minimal');
    api.setCurrentActivity('url');
    api.setModalState(true);
    await expectModal(root, 'url', 'open');
    const modalClose = vi.fn();
    onTestFinished(api.on('modal-close', modalClose));

    toUploadList(api);

    await expectModal(root, 'url', 'closed');
    expect(api.getCurrentActivity()).toBe('start-from');
    expect(modalClose).toHaveBeenCalledWith({ modalId: 'url', hasActiveModals: false });
    await expectModal(root, 'start-from', 'closed');
  });

  // As in v1: the in-place trigger stays behind a source modal, however the source was opened.
  it.each([
    [
      'setCurrentActivity + setModalState',
      (api: UploaderPublicApi) => {
        api.setCurrentActivity('url');
        api.setModalState(true);
      },
    ],
    ['navigate', (api: UploaderPublicApi) => api.navigate('url')],
  ])('keeps the choose-files trigger in place behind a source opened with %s', async (_, openUrl) => {
    const { root, api } = await renderSolution('minimal');
    const trigger = within(root).getByText('Choose files', { exact: true });
    await expect.element(trigger).toBeVisible();

    openUrl(api);

    await expectModal(root, 'url', 'open');
    await expectActivity(root, 'start-from');
    await expect.element(trigger).toBeVisible();
    expect(api.getCurrentActivity()).toBe('url');
  });

  it('says "Choose file" or "Choose files" as multiple toggles', async () => {
    const { root, config } = await renderSolution('minimal');

    config.multiple = false;
    await expect.element(within(root).getByText('Choose file', { exact: true })).toBeVisible();

    config.multiple = true;
    await expect.element(within(root).getByText('Choose files', { exact: true })).toBeVisible();
  });

  describe('grid view', () => {
    // The default 414px-wide viewport is below the theme's 430px breakpoint, which already sets one column.
    beforeEach(async () => {
      await page.viewport(1024, 768);
    });
    afterEach(async () => {
      await page.viewport(414, 896);
    });

    const THEME_GRID_COL = '3';

    const renderSingleGrid = async () => {
      const uploader = await renderSolution('minimal', { filesViewMode: 'grid', multiple: false });
      const dropArea = within(uploader.root).getByTestId('uc-drop-area').first().element() as DropArea;
      const gridCol = () => getComputedStyle(uploader.root).getPropertyValue('--uc-grid-col').trim();
      await expect.poll(gridCol).toBe('1');
      await expect.poll(() => dropArea.single).toBe(true);
      return { ...uploader, dropArea, gridCol };
    };

    it('uses one column and a single-file drop area for a single file, and drops both when multiple', async () => {
      const { config, dropArea, gridCol } = await renderSingleGrid();

      config.multiple = true;

      await expect.poll(gridCol).toBe(THEME_GRID_COL);
      await expect.poll(() => dropArea.single).toBe(false);
    });

    it('drops the single-column layout when leaving grid view', async () => {
      const { config, dropArea, gridCol } = await renderSingleGrid();

      config.filesViewMode = 'list';

      await expect.poll(gridCol).toBe(THEME_GRID_COL);
      await expect.poll(() => dropArea.single).toBe(false);
    });

    it("keeps the consumer's inline --uc-grid-col across updates", async () => {
      const { root, config, gridCol } = await renderSingleGrid();
      root.style.setProperty('--uc-grid-col', '4');

      config.multiple = true;
      await expect.poll(gridCol).toBe('4');
      config.multiple = false;
      config.filesViewMode = 'list';
      await delay(0);

      expect(root.style.getPropertyValue('--uc-grid-col')).toBe('4');
      expect(gridCol()).toBe('4');
    });
  });
});
