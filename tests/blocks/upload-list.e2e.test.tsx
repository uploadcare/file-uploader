import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { UploadCtxProvider } from '@/index.js';
import { TEST_IMAGE_URL } from '../utils/constants';
import { getCtxName } from '../utils/getCtxName';
import { type RenderedUploader, renderSolution, within } from '../utils/render-solution';
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

describe('uc-upload-list virtualization', () => {
  const addFiles = (api: RenderedUploader['api'], count: number) => {
    for (let i = 0; i < count; i++) {
      api.addFileFromObject(new File(['x'], `f${i}.txt`, { type: 'text/plain' }));
    }
  };

  it('renders every file of a page-scrolled inline list, so the page scrolls to the last one', async () => {
    // Nothing bounds the inline uploader's height, so `.uc-files` never scrolls: the page does.
    const { api, root } = await renderSolution('inline', { confirmUpload: true, multipleMax: 1000 });
    addFiles(api, 300);
    api.setCurrentActivity('upload-list');
    await expect.poll(() => root.querySelectorAll('uc-file-item').length).toBeGreaterThan(0);
    const files = root.querySelector<HTMLElement>('.uc-files')!;
    expect(files.scrollHeight).toBe(files.clientHeight);

    // A wrongly engaged virtualizer leaves a blank spacer at the bottom, so the last file never renders.
    const scrollPageToLastItem = () => {
      const scroller = document.scrollingElement!;
      scroller.scrollTop = scroller.scrollHeight;
      return root.querySelector('uc-file-item:last-of-type')?.textContent;
    };
    await expect.poll(scrollPageToLastItem).toContain('f299.txt');

    expect(root.querySelectorAll('uc-file-item')).toHaveLength(300);
    expect(root.querySelector('.uc-list-spacer')).toBeNull();
    const last = root.querySelector<HTMLElement>('uc-file-item:last-of-type')!;
    expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
  });

  it('still virtualizes the list the modal bounds', async () => {
    const { api, root } = await renderSolution('regular', { confirmUpload: true, multipleMax: 1000 });
    addFiles(api, 300);
    api.setCurrentActivity('upload-list');
    api.setModalState(true);
    await expect.element(within(root).getByTestId('uc-upload-list')).toBeVisible();

    await expect.poll(() => root.querySelector('.uc-list-spacer')).not.toBeNull();
    expect(root.querySelectorAll('uc-file-item').length).toBeLessThan(300);

    const files = root.querySelector<HTMLElement>('.uc-files')!;
    files.scrollTop = files.scrollHeight;
    await expect.poll(() => root.querySelector('uc-file-item:last-of-type')?.textContent).toContain('f299.txt');
  });
});
