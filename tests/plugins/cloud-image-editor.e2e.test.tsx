import { describe, expect, it, vi } from 'vitest';
import { cloudImageEditorPlugin } from '@/plugins/cloudImageEditorPlugin';
import { getApi, renderUploader, TEST_IMAGE_URL } from './utils';

const CLOUD_IMG_EDIT = 'cloud-image-edit';

describe('Cloud Image Editor Plugin', () => {
  describe('cloudImageEditorAutoOpen', () => {
    it('should open cloud editor after image upload when cloudImageEditorAutoOpen is true', async () => {
      const { config } = await renderUploader([cloudImageEditorPlugin]);
      config.useCloudImageEditor = true;
      config.cloudImageEditorAutoOpen = true;

      const api = getApi();
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();

      await vi.waitFor(() => expect(api.getCurrentActivity()).toBe(CLOUD_IMG_EDIT), { timeout: 10000 });
    });

    it('should not open cloud editor when cloudImageEditorAutoOpen is false', async () => {
      const { config } = await renderUploader([cloudImageEditorPlugin]);
      config.useCloudImageEditor = true;
      config.cloudImageEditorAutoOpen = false;

      const api = getApi();
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();

      await vi.waitFor(() => expect(api.getOutputCollectionState().successEntries.length).toBe(1), { timeout: 10000 });

      expect(api.getCurrentActivity()).not.toBe(CLOUD_IMG_EDIT);
    });

    it('should not open cloud editor when useCloudImageEditor is false', async () => {
      const { config } = await renderUploader([cloudImageEditorPlugin]);
      config.useCloudImageEditor = false;
      config.cloudImageEditorAutoOpen = true;

      const api = getApi();
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();

      await vi.waitFor(() => expect(api.getOutputCollectionState().successEntries.length).toBe(1), { timeout: 10000 });

      expect(api.getCurrentActivity()).not.toBe(CLOUD_IMG_EDIT);
    });

    it('should not open cloud editor when more than one file is in the collection', async () => {
      const { config } = await renderUploader([cloudImageEditorPlugin]);
      config.useCloudImageEditor = true;
      config.cloudImageEditorAutoOpen = true;
      config.multiple = true;

      const api = getApi();
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();

      await vi.waitFor(() => expect(api.getOutputCollectionState().successEntries.length).toBe(2), { timeout: 10000 });

      expect(api.getCurrentActivity()).not.toBe(CLOUD_IMG_EDIT);
    });
  });

  describe('cropPreset', () => {
    it('should apply crop modifiers to uploaded image when cropPreset is set', async () => {
      const { config } = await renderUploader([cloudImageEditorPlugin]);
      config.cropPreset = '16:9';

      const api = getApi();
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();

      await vi.waitFor(
        () => {
          const entry = api.getOutputCollectionState().allEntries[0];
          expect(entry?.cdnUrlModifiers).toMatch(/\/crop\//);
        },
        { timeout: 10000 },
      );
    });

    it('should open cloud editor after upload when cropPreset and useCloudImageEditor are set', async () => {
      const { config } = await renderUploader([cloudImageEditorPlugin]);
      config.useCloudImageEditor = true;
      config.cropPreset = '16:9';

      const api = getApi();
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();

      await vi.waitFor(() => expect(api.getCurrentActivity()).toBe(CLOUD_IMG_EDIT), { timeout: 10000 });
    });
  });
});
