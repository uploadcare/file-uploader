import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { UploadCtxProvider } from '@/index.js';
import { TEST_IMAGE_URL } from '../utils/constants';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

/**
 * M9i Task 1 gap-fill — `UploadList` has no dedicated suite; the
 * `.uc-common-error` rendering driven by `*collectionErrors` (UploadList.ts)
 * was entirely untested ahead of the container's v2 port.
 */
describe('uc-upload-list common error rendering', () => {
  it('shows .uc-common-error once a collection-level validation error is set, and hides it again once resolved', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config
          qualityInsights={false}
          ctx-name={ctxName}
          pubkey="demopublickey"
          testMode
          multiple
          multipleMax={1}
          confirmUpload
        ></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = uploadCtxProvider.api;

    await page.getByText('Upload files', { exact: true }).click();
    await expect.element(page.getByTestId('uc-start-from')).toBeVisible();

    // Two idle files against `multipleMax: 1` trips the collection-level
    // TOO_MANY_FILES validator, which UploadList surfaces as a common error.
    // `initFlow()` is the real navigation driver into upload-list (v1 parity
    // with the start-from suite) — `addFileFromUrl` alone only adds to the
    // collection, it doesn't navigate.
    api.addFileFromUrl(TEST_IMAGE_URL);
    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    const uploadList = page.getByTestId('uc-upload-list');
    await expect.element(uploadList).toBeVisible();

    const commonError = () => document.querySelector('uc-upload-list .uc-common-error');
    await expect.poll(() => commonError()?.hasAttribute('hidden')).toBe(false);
    await expect
      .poll(() => commonError()?.textContent?.trim())
      .toBe('You’ve chosen too many files. 1 file is maximum.');

    // Raising the limit clears the collection-level error and the message
    // hides again — same `*collectionErrors` sub, opposite direction.
    const config = document.querySelector('uc-config') as HTMLElement & { multipleMax: number };
    config.multipleMax = 2;

    await expect.poll(() => commonError()?.hasAttribute('hidden')).toBe(true);
  });
});
