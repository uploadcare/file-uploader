import { describe, expect, it } from 'vitest';
import { TEST_IMAGE_URL } from '~/tests/utils/constants';
import { renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

const CLOUD_IMG_EDIT = 'cloud-image-edit';
// Real uploads run against the network.
const UPLOAD = { timeout: 10000 };

describe('cloud image editor options', () => {
  describe('cloudImageEditorAutoOpen', () => {
    it('opens the editor after an image upload when set', async () => {
      const { api } = await renderSolution('regular', { useCloudImageEditor: true, cloudImageEditorAutoOpen: true });
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();

      await expect.poll(() => api.getCurrentActivity(), UPLOAD).toBe(CLOUD_IMG_EDIT);
    });

    it('opens the editor on the uploaded file', async () => {
      const { api, root } = await renderSolution('regular', {
        useCloudImageEditor: true,
        cloudImageEditorAutoOpen: true,
      });
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();

      const editor = within(root).getByTestId('uc-cloud-image-editor');
      await expect.element(editor, UPLOAD).toBeVisible();
      const { cdnUrl } = api.getOutputCollectionState().allEntries[0];
      expect(cdnUrl).toBeTruthy();
      await expect.poll(() => editor.element().getAttribute('cdn-url')).toBe(cdnUrl);
    });

    it('leaves the editor and keeps the file uploaded when Apply is pressed', async () => {
      const { api, root } = await renderSolution('regular', {
        useCloudImageEditor: true,
        cloudImageEditorAutoOpen: true,
      });
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();
      await expect.element(within(root).getByTestId('uc-cloud-image-editor'), UPLOAD).toBeVisible();

      await within(root).getByRole('button', { name: /apply/i }).click();

      await expect.poll(() => api.getCurrentActivity(), UPLOAD).not.toBe(CLOUD_IMG_EDIT);
      expect(api.getOutputCollectionState().successEntries).toHaveLength(1);
    });

    it('does not open the editor when unset', async () => {
      const { api } = await renderSolution('regular', { useCloudImageEditor: true, cloudImageEditorAutoOpen: false });
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();

      await expect.poll(() => api.getOutputCollectionState().successEntries.length, UPLOAD).toBe(1);
      expect(api.getCurrentActivity()).not.toBe(CLOUD_IMG_EDIT);
    });

    it('does not open the editor when useCloudImageEditor is false', async () => {
      const { api } = await renderSolution('regular', { useCloudImageEditor: false, cloudImageEditorAutoOpen: true });
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();

      await expect.poll(() => api.getOutputCollectionState().successEntries.length, UPLOAD).toBe(1);
      expect(api.getCurrentActivity()).not.toBe(CLOUD_IMG_EDIT);
    });

    it('does not open the editor when more than one file is in the collection', async () => {
      const { api } = await renderSolution('regular', {
        useCloudImageEditor: true,
        cloudImageEditorAutoOpen: true,
        multiple: true,
      });
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();

      await expect.poll(() => api.getOutputCollectionState().successEntries.length, UPLOAD).toBe(2);
      expect(api.getCurrentActivity()).not.toBe(CLOUD_IMG_EDIT);
    });
  });

  describe('cropPreset', () => {
    it('applies crop modifiers to the uploaded image', async () => {
      const { api } = await renderSolution('regular', { cropPreset: '16:9' });
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();

      await expect
        .poll(() => api.getOutputCollectionState().allEntries[0]?.cdnUrlModifiers, UPLOAD)
        .toMatch(/\/crop\//);
    });

    it('opens the editor after upload when useCloudImageEditor is also set', async () => {
      const { api } = await renderSolution('regular', { useCloudImageEditor: true, cropPreset: '16:9' });
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();

      await expect.poll(() => api.getCurrentActivity(), UPLOAD).toBe(CLOUD_IMG_EDIT);
    });
  });
});
