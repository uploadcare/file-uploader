import { describe, expect, it } from 'vitest';
import '~/types/jsx';
import { IMAGE, testFile } from '~/tests/fixtures/files';
import { renderSolution, within } from '~/tests/utils/render-solution';

describe('validation: built-in rules', () => {
  describe('imgOnly', () => {
    it('shows an error when a non-image file is added', async () => {
      const { api, root } = await renderSolution('regular', { imgOnly: true });
      api.addFileFromObject(testFile('chucknorris.txt', 'text/plain'));
      api.initFlow();
      await expect.element(within(root).getByText('Only image files are accepted')).toBeVisible();
    });
  });

  describe('accept', () => {
    it('shows an error when a file of a non-accepted type is added', async () => {
      const { api, root } = await renderSolution('regular', { accept: 'image/png' });
      api.addFileFromObject(testFile('chucknorris.jpg'));
      api.initFlow();
      await expect.element(within(root).getByText('Uploading of these file types is not allowed')).toBeVisible();
    });
  });

  describe('maxLocalFileSizeBytes', () => {
    it('shows an error when the file is too large', async () => {
      const { api, root } = await renderSolution('regular', { maxLocalFileSizeBytes: 1024 });
      api.addFileFromObject(new File([new ArrayBuffer(2048)], 'largefile.jpg', { type: 'image/jpeg' }));
      api.initFlow();
      await expect.element(within(root).getByText('File is too big')).toBeVisible();
    });
  });

  describe('server-side validation', () => {
    it('shows an error when the server rejects the file', async () => {
      const { api, root } = await renderSolution('regular');
      api.addFileFromUrl('https://fake-domain-that-will-404.com/image.jpg');
      api.initFlow();
      await expect.element(within(root).getByText('Host does not exist')).toBeVisible();
    });
  });

  describe('multiple', () => {
    it('shows an error when several files are added and multiple is false', async () => {
      const { api, root } = await renderSolution('regular', { multiple: false });
      api.addFileFromObject(IMAGE.PIXEL);
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.element(within(root).getByText('You’ve chosen too many files')).toBeVisible();
    });

    it('shows an error when more than multipleMax files are added', async () => {
      const { api, root } = await renderSolution('regular', { multipleMax: 2 });
      api.addFileFromObject(IMAGE.PIXEL);
      api.addFileFromObject(IMAGE.PIXEL);
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.element(within(root).getByText('You’ve chosen too many files')).toBeVisible();
    });

    it('shows an error when fewer than multipleMin files are added', async () => {
      const { api, root } = await renderSolution('regular', { multipleMin: 2 });
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.element(within(root).getByText('At least 2 files required')).toBeVisible();
    });
  });
});
