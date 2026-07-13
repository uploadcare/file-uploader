import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { cloudImageEditorPlugin } from '@/plugins/cloudImageEditorPlugin';
import { TEST_IMAGE_URL } from '../utils/constants';
import { getApi, renderUploader } from './utils';

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

  // Gap-fill (M9j Task 1): `getCurrentActivity() === CLOUD_IMG_EDIT` above only
  // pins the router's activity string. It doesn't prove CloudImageEditorActivity
  // itself mounted correctly off `activityParams.internalId` — i.e. that
  // `uploadCollection.read(internalId)` resolved the right entry and the block
  // rendered `<uc-cloud-image-editor>` wired to its `cdnUrl`. The port (Task 3)
  // touches exactly this path (`this.router` → `bag.router`, `activityParams`
  // inline-cast, `this.uploadCollection` partitioning), so pin the DOM outcome.
  describe('params-driven open (gap-fill)', () => {
    it('mounts uc-cloud-image-editor with the resolved entry cdnUrl when the activity opens', async () => {
      const { config } = await renderUploader([cloudImageEditorPlugin]);
      config.useCloudImageEditor = true;
      config.cloudImageEditorAutoOpen = true;

      const api = getApi();
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();

      await vi.waitFor(() => expect(api.getCurrentActivity()).toBe(CLOUD_IMG_EDIT), { timeout: 10000 });

      const editor = page.getByTestId('uc-cloud-image-editor');
      await expect.element(editor).toBeVisible();

      const entry = api.getOutputCollectionState().allEntries[0];
      expect(entry?.cdnUrl).toBeTruthy();
      await expect.poll(() => editor.element().getAttribute('cdn-url')).toBe(entry?.cdnUrl);
    });

    it('navigates back and keeps the entry uploaded when Apply is pressed inside the activity', async () => {
      const { config } = await renderUploader([cloudImageEditorPlugin]);
      config.useCloudImageEditor = true;
      config.cloudImageEditorAutoOpen = true;

      const api = getApi();
      api.addFileFromUrl(TEST_IMAGE_URL);
      api.initFlow();

      await vi.waitFor(() => expect(api.getCurrentActivity()).toBe(CLOUD_IMG_EDIT), { timeout: 10000 });
      await expect.element(page.getByTestId('uc-cloud-image-editor')).toBeVisible();

      const apply = page.getByRole('button', { name: /apply/i });
      await apply.click();

      await vi.waitFor(() => expect(api.getCurrentActivity()).not.toBe(CLOUD_IMG_EDIT), { timeout: 10000 });

      const entry = api.getOutputCollectionState().allEntries[0];
      expect(entry?.cdnUrl).toBeTruthy();
    });
  });
});
