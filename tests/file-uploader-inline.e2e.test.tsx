import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { FileUploaderInline } from '@/index';
import { ACTIVITY_TYPES } from '@/lit/activity-constants.js';
import { PubSub } from '@/lit/PubSubCompat.js';
import { getCtxName } from './utils/getCtxName';
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
      <uc-file-uploader-inline ctx-name={ctxName}></uc-file-uploader-inline>
      <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
});

describe('File uploader inline', () => {
  it('should be rendered', async () => {
    await expect.element(page.getByTestId('uc-start-from').getByText('Drop files here', { exact: true })).toBeVisible();
  });

  it('should open the url source, when clicked', async () => {
    await page.getByText('From link', { exact: true }).click();
    const urlSource = page.getByTestId('uc-url-source');
    await expect(urlSource).toBeDefined();
  });

  it('should open the camera source, when clicked', async () => {
    // Intentionally do not test full recording/accept flow here:
    // media-recorder interactions are flaky in CI and may close the browser connection.
    // This test focuses on camera source availability and primary controls rendering.
    await page.getByTestId('uc-start-from').getByText('Camera', { exact: true }).click();

    const cameraSource = page.getByTestId('uc-camera-source');
    await expect.element(cameraSource).toBeVisible();

    const tabVideo = cameraSource.getByTestId('uc-camera-source--tab-video');
    await userEvent.click(tabVideo);
    await expect(tabVideo).toHaveClass('uc-active');

    const toggleMicrophone = cameraSource.getByTestId('uc-camera-source--toggle-microphone');
    await expect(toggleMicrophone).toBeVisible();

    const shot = cameraSource.getByTestId('uc-camera-source--shot');
    await expect(shot).toBeDefined();
  });
});

/**
 * M9r Task 1 — coverage-first safety net ahead of the ChildBlock port of the
 * three solution blocks. Pins inline-specific behavior the port could
 * plausibly change: standalone bootstrap/teardown, all-background
 * `router.navigationStrategy`, and the drop-area + source-list + upload-list
 * composition. Each test renders its own isolated composition via
 * `cleanup()` + `page.render(...)`, overriding the file-level `beforeEach`
 * default composition so it never collides with it.
 */
describe('File uploader inline — M9r solution-block safety net', () => {
  describe('Standalone bootstrap/teardown', () => {
    it('self-bootstraps its ctx from a bare config+solution composition, and tears it down on removal', async () => {
      cleanup();
      const ctxName = getCtxName();
      page.render(
        <>
          <uc-file-uploader-inline ctx-name={ctxName}></uc-file-uploader-inline>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        </>,
      );

      await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);

      cleanup();
      await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(false);
    });
  });

  describe('router.navigationStrategy', () => {
    it('always resolves to "background" (no modal), for any activity', async () => {
      cleanup();
      const ctxName = getCtxName();
      page.render(
        <>
          <uc-file-uploader-inline ctx-name={ctxName}></uc-file-uploader-inline>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        </>,
      );
      await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);

      const el = page.getByTestId('uc-file-uploader-inline').query()! as FileUploaderInline;

      expect(el.router.navigationStrategy(ACTIVITY_TYPES.UPLOAD_LIST)).toBe('background');
      expect(el.router.navigationStrategy(ACTIVITY_TYPES.START_FROM)).toBe('background');
      expect(el.router.navigationStrategy(ACTIVITY_TYPES.CAMERA)).toBe('background');
      expect(el.router.navigationStrategy(ACTIVITY_TYPES.URL)).toBe('background');
    });
  });

  describe('Composition', () => {
    it('renders the drop area, source list, and upload list in place (no modal)', async () => {
      cleanup();
      const ctxName = getCtxName();
      page.render(
        <>
          <uc-file-uploader-inline ctx-name={ctxName}></uc-file-uploader-inline>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
          <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
        </>,
      );
      await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);

      // Inline renders a drop-area both in the start-from view and as the
      // upload-list ghost, so scope to the first (in-place) one.
      await expect.element(page.getByTestId('uc-drop-area').first()).toBeVisible();
      await expect.element(page.getByTestId('uc-source-list')).toBeVisible();
      // The upload list exists in the light DOM alongside start-from (both
      // rendered unconditionally; the router's background slot toggles which
      // is visually active), never inside a `<uc-modal>`.
      expect(page.getByTestId('uc-upload-list').query()).not.toBeNull();
      expect(page.getByTestId('uc-modal').query()).toBeNull();
    });
  });
});
