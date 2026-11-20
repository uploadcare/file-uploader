import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { ProgressBar, UploadCtxProvider } from '@/index.js';
import { TEST_IMAGE_URL } from '../utils/constants';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

/**
 * M9h Task 1 — gap-fill ahead of the ChildBlock port of ProgressBarCommon.
 *
 * `uc-progress-bar-common` is a documented standalone public element
 * (exported from `src/index.ts`) whose entire behavior is bridging real
 * upload state — `uploadCollection` (any item `isUploading`) and the shared
 * `*commonProgress` value — into the inner `<uc-progress-bar>`'s
 * `.visible`/`.value`. Before this suite, it had zero dedicated coverage:
 * `tests/blocks/progress-bar.e2e.test.tsx` only drives the inner
 * `<uc-progress-bar>` directly via its own properties, never through
 * ProgressBarCommon's real upload-driven wiring. A ChildBlock rewrite of
 * `initCallback`'s `uploadCollection.observeProperties` / `sub('*commonProgress', ...)`
 * subscriptions could silently break this visibility lifecycle with nothing
 * to catch it.
 */
describe('uc-progress-bar-common', () => {
  const render = () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-progress-bar-common ctx-name={ctxName}></uc-progress-bar-common>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();
    const innerBar = () => document.querySelector('uc-progress-bar-common uc-progress-bar') as ProgressBar | null;
    return { api, innerBar };
  };

  it('keeps the inner progress bar hidden before any upload starts', async () => {
    const { innerBar } = render();
    await expect.poll(() => innerBar()).toBeTruthy();
    expect(innerBar()!.visible).toBe(false);
  });

  it('shows the inner progress bar while uploading and hides it again on completion', async () => {
    const { api, innerBar } = render();

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.uploadAll();

    await expect.poll(() => innerBar()?.visible, { timeout: 20_000 }).toBe(true);

    await expect.poll(() => api.getOutputCollectionState().successCount, { timeout: 20_000 }).toBe(1);
    await expect.poll(() => innerBar()?.visible, { timeout: 20_000 }).toBe(false);
  }, 30_000);

  it('syncs the inner progress bar value from *commonProgress up to completion', async () => {
    const { api, innerBar } = render();

    api.addFileFromUrl(TEST_IMAGE_URL);
    api.uploadAll();

    await expect.poll(() => api.getOutputCollectionState().successCount, { timeout: 20_000 }).toBe(1);
    await expect.poll(() => innerBar()?.value, { timeout: 20_000 }).toBe(100);
  }, 30_000);
});
