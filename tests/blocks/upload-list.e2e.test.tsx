import { beforeAll, describe, expect, it, onTestFinished } from 'vitest';
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

  // Rows below the viewport render empty until they scroll in, and the list's height moves as rows are measured, so
  // one scroll to the bottom can land short of it: scroll again on every poll.
  const scrollToBottom = (files: HTMLElement, lastRow: () => Element | undefined) => {
    files.scrollTop = files.scrollHeight;
    return lastRow();
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
    const lastRow = () => root.querySelector('uc-file-item:last-of-type') ?? undefined;
    await expect.poll(() => scrollToBottom(files, lastRow)?.textContent).toContain('f299.txt');
  });

  it('drops the gap below the last file only, as in 1.35, not below the last rendered row', async () => {
    const { api, root } = await renderSolution('regular', { confirmUpload: true, multipleMax: 1000 });
    addFiles(api, 300);
    api.setCurrentActivity('upload-list');
    api.setModalState(true);
    await expect.poll(() => root.querySelector('.uc-list-spacer')).not.toBeNull();
    // A row not yet in view renders an empty shell, so read the gap its height and margin come from.
    const gapBelow = (row: Element | undefined) =>
      row ? getComputedStyle(row).getPropertyValue('--uc-file-item-gap').trim() : null;
    const lastRendered = () => [...root.querySelectorAll('uc-file-item')].at(-1);

    // Mid-list the last rendered row has a spacer after it and keeps its gap.
    expect(gapBelow(lastRendered())).toBe('4px');

    const files = root.querySelector<HTMLElement>('.uc-files')!;
    await expect.poll(() => scrollToBottom(files, lastRendered)?.textContent).toContain('f299.txt');
    await expect.poll(() => gapBelow(lastRendered())).toBe('0');
  });

  const height = (el: Element) => el.getBoundingClientRect().height;
  const sum = (els: Iterable<Element>) => [...els].reduce((total, el) => total + height(el), 0);
  const rowIndex = (row: Element | undefined) => Number(/f(\d+)\.txt/.exec(row?.textContent ?? '')?.[1] ?? Number.NaN);

  // Rows differ: one not yet scrolled into view renders an empty shell (FileItem's render gate), shorter than a
  // rendered one. Whatever height the spacers assume per row must lie between the shortest and tallest rendered row
  // (give or take the half pixel the estimate may lag by), or the scroll offset stops pointing at the rows it shows.
  // Checked at the top, mid-list and at the bottom.
  const expectSpacersToMatchRows = async (root: HTMLElement) => {
    const files = root.querySelector<HTMLElement>('.uc-files')!;
    const rows = () => [...root.querySelectorAll('uc-file-item')];
    const heights = () => rows().map(height);
    const laidOut = () => sum(root.querySelectorAll('.uc-list-spacer')) + sum(rows());
    const withinRows = () => {
      const [min, max] = [Math.min(...heights()), Math.max(...heights())];
      return laidOut() >= 300 * (min - 0.5) && laidOut() <= 300 * (max + 0.5);
    };
    await expect.poll(withinRows).toBe(true);

    // Mid-list, the row at the viewport's top is the one the scroll offset points at.
    files.scrollTop = 8400;
    const rowAtTop = () => {
      const top = files.getBoundingClientRect().top;
      return rows().find((row) => row.getBoundingClientRect().bottom > top);
    };
    const pointsAtItsRow = () => {
      const index = rowIndex(rowAtTop());
      return (
        index >= Math.floor(8400 / (Math.max(...heights()) + 0.5)) &&
        index <= Math.ceil(8400 / (Math.min(...heights()) - 0.5))
      );
    };
    await expect.poll(pointsAtItsRow).toBe(true);
    expect(withinRows()).toBe(true);

    // At the bottom the last file renders with no spacer after it.
    await expect.poll(() => rowIndex(scrollToBottom(files, () => rows().at(-1)))).toBe(299);
    expect(rows().at(-1)!.nextElementSibling?.classList.contains('uc-list-spacer') ?? false).toBe(false);
    expect(withinRows()).toBe(true);
  };

  it('sizes the spacers from the rows it renders, not the first one', async () => {
    const { api, root } = await renderSolution('regular', { confirmUpload: true, multipleMax: 1000 });
    addFiles(api, 300);
    api.setCurrentActivity('upload-list');
    api.setModalState(true);
    await expect.poll(() => root.querySelector('.uc-list-spacer')).not.toBeNull();

    await expectSpacersToMatchRows(root);
  });

  it('corrects a row height measured before the rows were laid out', async () => {
    // Rows collapsed when first measured, as they can be during the modal's opening layout.
    const collapse = document.createElement('style');
    collapse.textContent = 'uc-file-item { min-height: 0; height: 13px; }';
    document.head.append(collapse);
    onTestFinished(() => collapse.remove());
    const { api, root } = await renderSolution('regular', { confirmUpload: true, multipleMax: 1000 });
    addFiles(api, 300);
    api.setCurrentActivity('upload-list');
    api.setModalState(true);
    await expect.poll(() => root.querySelector('.uc-list-spacer')).not.toBeNull();
    collapse.remove();

    await expectSpacersToMatchRows(root);
  });

  it('keeps a minimum height on the last file, which has no gap below it', async () => {
    // A row renders empty until it scrolls into view, so with no height of its own the last one never would.
    const { api, root } = await renderSolution('regular', { confirmUpload: true, multipleMax: 1000 });
    addFiles(api, 3);
    api.setCurrentActivity('upload-list');
    api.setModalState(true);
    await expect.poll(() => root.querySelectorAll('uc-file-item').length).toBe(3);

    const [first, , last] = root.querySelectorAll('uc-file-item');
    const minHeight = (row: Element | undefined) => Number.parseFloat(row ? getComputedStyle(row).minHeight : '');
    expect(minHeight(last)).toBeGreaterThan(0);
    // The gap is all it drops.
    expect(minHeight(first) - minHeight(last)).toBe(4);
  });
});
