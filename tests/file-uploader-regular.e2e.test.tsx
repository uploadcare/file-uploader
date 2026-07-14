import { beforeAll, beforeEach, describe, expect, it, test, vi } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { A11y } from '@/abstract/managers/a11y.js';
import type { FileUploaderRegular } from '@/index.js';
import { ACTIVITY_TYPES } from '@/lit/activity-constants.js';
import { PubSub } from '@/lit/PubSubCompat.js';
import type { SharedState } from '@/lit/SharedState.js';
import { fileUploaderLazyPlugins } from '@/solutions/file-uploader/lazyPlugins.js';
import { delay } from '@/utils/delay.js';
import { TEST_IMAGE_URL } from './utils/constants';
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
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
});

describe('File uploader regular', () => {
  describe('Upload button', () => {
    it('should be rendered', async () => {
      await expect.element(page.getByText('Upload files', { exact: true })).toBeVisible();
    });
  });

  describe('Modal: start from', async () => {
    it('should be opened on upload button click', async () => {
      await page.getByText('Upload files', { exact: true }).click();
      const startFrom = page.getByTestId('uc-start-from');
      await expect.element(startFrom).toBeVisible();
    });

    it('should have default sources', async () => {
      await page.getByText('Upload files', { exact: true }).click();
      const startFrom = page.getByTestId('uc-start-from');

      await expect.element(startFrom.getByText('From device', { exact: true })).toBeVisible();
      await expect.element(startFrom.getByText('From link', { exact: true })).toBeVisible();
      await expect.element(startFrom.getByText('Camera', { exact: true })).toBeVisible();
      await expect.element(startFrom.getByText('Dropbox', { exact: true })).toBeVisible();
      await expect.element(startFrom.getByText('Google Drive', { exact: true })).toBeVisible();
    });

    it('should have copyright', async () => {
      await page.getByText('Upload files', { exact: true }).click();

      const startFrom = page.getByTestId('uc-start-from');
      await expect.element(startFrom.getByText('Powered by Uploadcare', { exact: true })).toBeVisible();
    });

    it('should have cancel button', async () => {
      await page.getByText('Upload files', { exact: true }).click();

      const startFrom = page.getByTestId('uc-start-from');
      await expect.element(startFrom.getByText('Cancel', { exact: true })).toBeVisible();
    });

    it('should close modal on cancel button click', async () => {
      await page.getByText('Upload files', { exact: true }).click();

      const startFrom = page.getByTestId('uc-start-from');
      await startFrom.getByText('Cancel', { exact: true }).click();
      await expect.element(startFrom).not.toBeVisible();
    });

    it('should close modal on overlay click', async () => {
      await page.getByText('Upload files', { exact: true }).click();
      const startFrom = page.getByTestId('uc-start-from');
      await userEvent.click(document.body, {
        position: {
          x: 10,
          y: 10,
        },
      });
      await expect.element(startFrom).not.toBeVisible();
    });
  });

  describe('Add files to the upload list', () => {
    test('from device', async () => {
      await page.getByText('Upload files', { exact: true }).click();
      const startFrom = page.getByTestId('uc-start-from');
      const uploadList = page.getByTestId('uc-upload-list');

      commands.waitFileChooserAndUpload(['./fixtures/test_image.jpeg']);

      await startFrom.getByText('From device', { exact: true }).click();

      await expect.element(startFrom).not.toBeVisible();
      await expect.element(uploadList).toBeVisible();

      await expect.element(page.getByText('test_image.jpeg')).toBeVisible();
      await expect.element(page.getByText('1 file uploaded')).toBeVisible();
    });

    test('from link', async () => {
      await page.getByText('Upload files', { exact: true }).click();
      const startFrom = page.getByTestId('uc-start-from');
      const uploadList = page.getByTestId('uc-upload-list');
      const urlSource = page.getByTestId('uc-url-source');

      await expect.element(startFrom).toBeVisible();
      await startFrom.getByText('From link').click();
      await expect.element(startFrom).not.toBeVisible();
      await expect.element(urlSource).toBeVisible();

      const urlInput = urlSource.getByPlaceholder('https://');
      await userEvent.fill(urlInput, TEST_IMAGE_URL);
      await userEvent.keyboard('{Enter}');

      await expect.element(uploadList).toBeVisible();
      await expect.element(page.getByText('prithiviraj-a-fa7Stge3YXs-unsplash.jpg')).toBeVisible();
      await expect.element(page.getByText('1 file uploaded')).toBeVisible();
    });

    test('from camera', async () => {
      await page.getByText('Upload files', { exact: true }).click();
      const startFrom = page.getByTestId('uc-start-from');
      const uploadList = page.getByTestId('uc-upload-list');
      const cameraSource = page.getByTestId('uc-camera-source');

      await expect.element(startFrom).toBeVisible();
      await startFrom.getByText('Camera').click();
      await expect.element(startFrom).not.toBeVisible();
      await expect.element(cameraSource).toBeVisible();

      const cameraButton = cameraSource.getByTestId('uc-camera-source--shot');
      await userEvent.click(cameraButton);

      const acceptButton = cameraSource.getByTestId('uc-camera-source--accept');
      await userEvent.click(acceptButton);

      await expect.element(uploadList).toBeVisible();
      await expect.element(page.getByText(/camera-\d+\.jpeg/)).toBeVisible();
      await expect.element(page.getByText('1 file uploaded')).toBeVisible();
    });
  });
});

/**
 * M9r Task 1 — coverage-first safety net ahead of the ChildBlock port of the
 * three solution blocks (`LitSolutionBlock` + `FileUploaderRegular` currently
 * sit on the v1 `LitBlock`/`SymbioteCompatMixin` stack). These pins cover
 * behavior the port could plausibly change: the standalone self-bootstrap/
 * teardown path (the `init$` drop must preserve it), `router.navigationStrategy`,
 * `headless`/`dynamicButton`/`isDynamicButtonActive`, and the shared
 * `LitSolutionBlock.initCallback` contract (solutionName, lazyPlugins, a11y +
 * clipboard scope registration/release). Each test renders its own isolated
 * composition via `cleanup()` + `page.render(...)`, overriding the file-level
 * `beforeEach` default composition, so it never collides with it.
 */
describe('File uploader regular — M9r solution-block safety net', () => {
  describe('Standalone bootstrap/teardown', () => {
    it('self-bootstraps its ctx from a bare config+solution composition, and tears it down on removal', async () => {
      cleanup();
      const ctxName = getCtxName();
      page.render(
        <>
          <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        </>,
      );

      await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);

      cleanup();
      await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(false);
    });
  });

  describe('router.navigationStrategy', () => {
    it('always resolves to "foreground", for any activity', async () => {
      cleanup();
      const ctxName = getCtxName();
      page.render(
        <>
          <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        </>,
      );
      await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);

      const el = page.getByTestId('uc-file-uploader-regular').query()! as FileUploaderRegular;
      // Post-ChildBlock-port accessor: `router` is no longer a public instance
      // getter (v1 `LitBlock` surface) — reach it via the protected `bag`,
      // same pattern as `tests/blocks/activity-child-block.e2e.test.tsx`'s
      // `routerOf`.
      const router = (el as any).bag.router;

      expect(router.navigationStrategy(ACTIVITY_TYPES.UPLOAD_LIST)).toBe('foreground');
      expect(router.navigationStrategy(ACTIVITY_TYPES.START_FROM)).toBe('foreground');
      expect(router.navigationStrategy(ACTIVITY_TYPES.CAMERA)).toBe('foreground');
      expect(router.navigationStrategy(ACTIVITY_TYPES.URL)).toBe('foreground');
    });
  });

  describe('headless / dynamicButton', () => {
    it('headless hides the upload button entirely', async () => {
      cleanup();
      const ctxName = getCtxName();
      page.render(
        <>
          <uc-file-uploader-regular headless ctx-name={ctxName}></uc-file-uploader-regular>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        </>,
      );
      await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);

      expect(page.getByTestId('uc-simple-btn').query()).toBeNull();
      expect(page.getByTestId('uc-dynamic-btn').query()).toBeNull();
    });

    it('dynamicButton swaps uc-simple-btn for uc-dynamic-btn, and isDynamicButtonActive reflects the property', async () => {
      cleanup();
      const ctxName = getCtxName();
      page.render(
        <>
          <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        </>,
      );
      await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);

      const el = page.getByTestId('uc-file-uploader-regular').query()! as FileUploaderRegular;
      expect(el.isDynamicButtonActive).toBe(false);
      await expect.element(page.getByTestId('uc-simple-btn')).toBeVisible();
      expect(page.getByTestId('uc-dynamic-btn').query()).toBeNull();

      el.dynamicButton = true;
      await el.updateComplete;

      expect(el.isDynamicButtonActive).toBe(true);
      await expect.element(page.getByTestId('uc-dynamic-btn')).toBeVisible();
      expect(page.getByTestId('uc-simple-btn').query()).toBeNull();
    });
  });

  describe('Shared LitSolutionBlock.initCallback contract', () => {
    it('records the lowercased tag name as the controller solutionName, and publishes lazyPlugins', async () => {
      cleanup();
      const ctxName = getCtxName();
      page.render(
        <>
          <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        </>,
      );
      await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);

      const ctx = PubSub.getCtx<SharedState>(ctxName)!;
      const controller = ctx.uploaderController();

      expect(controller.solutionName).toBe('uc-file-uploader-regular');
      expect(ctx.read('*lazyPlugins')).toBe(fileUploaderLazyPlugins);
    });

    it('registers the a11y block while connected', async () => {
      const registerBlockSpy = vi.spyOn(A11y.prototype, 'registerBlock');
      try {
        cleanup();
        const ctxName = getCtxName();
        page.render(
          <>
            <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
            <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
          </>,
        );
        await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);

        const el = page.getByTestId('uc-file-uploader-regular').query()!;
        expect(registerBlockSpy).toHaveBeenCalledWith(el);
      } finally {
        registerBlockSpy.mockRestore();
      }
    });

    it('registers a clipboard scope while connected, and releases it on disconnect while the ctx stays alive', async () => {
      cleanup();
      const ctxName = getCtxName();
      // A third, independent block (`uc-upload-ctx-provider`) keeps the ctx
      // referenced after the solution tag itself is removed, so this isolates
      // the scope-release call from full ctx teardown (which would destroy the
      // clipboard controller outright and make the assertion vacuous).
      page.render(
        <>
          <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
          <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
        </>,
      );
      await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);

      const ctx = PubSub.getCtx<SharedState>(ctxName)!;
      const controller = ctx.uploaderController();
      const clipboard = controller.clipboard as unknown as { _scopes: Set<Node> };
      const el = page.getByTestId('uc-file-uploader-regular').query()!;

      expect(clipboard._scopes.has(el)).toBe(true);

      el.remove();
      await delay(0);

      // The ctx is still alive (config + ctx-provider remain), so this proves
      // the scope was released on disconnect specifically, not via full
      // ctx/clipboard-controller teardown.
      expect(PubSub.hasCtx(ctxName)).toBe(true);
      expect(clipboard._scopes.has(el)).toBe(false);
    });
  });
});
