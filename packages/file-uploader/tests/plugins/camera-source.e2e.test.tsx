import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { browserFeatures } from '@/utils/browser-info';
import { openModal, renderUploader } from './utils';

describe('Camera Source', () => {
  it('should render Photo and Video buttons on mobile (htmlMediaCapture)', async () => {
    const original = browserFeatures.htmlMediaCapture;
    (browserFeatures as { htmlMediaCapture: boolean }).htmlMediaCapture = true;

    try {
      await renderUploader();
      await openModal();

      await expect.element(page.getByText('Photo')).toBeVisible();
      await expect.element(page.getByText('Video')).toBeVisible();
    } finally {
      (browserFeatures as { htmlMediaCapture: boolean }).htmlMediaCapture = original;
    }
  });
});
