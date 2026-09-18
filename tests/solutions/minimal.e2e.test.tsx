import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { TEST_IMAGE_URL } from '~/tests/utils/constants';
import '~/types/jsx';
import { testFile } from '~/tests/fixtures/files';
import { renderSolution, within } from '~/tests/utils/render-solution';

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
});
