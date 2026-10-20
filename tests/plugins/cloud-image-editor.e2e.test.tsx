import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { cloudImageEditorPlugin } from '@/plugins/cloudImageEditorPlugin';
import { TEST_IMAGE_URL } from '../utils/constants';
import { getApi, renderUploader } from './utils';

const CLOUD_IMG_EDIT = 'cloud-image-edit';

describe('Cloud Image Editor Plugin', () => {
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
