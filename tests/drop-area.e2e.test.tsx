import { beforeAll, describe, expect, it } from 'vitest';
import { delay } from '@/utils/delay';
import { expectActivity, renderSolution, within } from './utils/render-solution';
import '../types/jsx';

/**
 * `<uc-drop-area>` and its `addDropzone` helper. `tests/file-uploader-minimal.e2e.test.tsx` drops one file; the drag
 * state machine, the url branch and the rules that switch the area off had no coverage.
 */

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

const openStartFrom = async (configProps: Parameters<typeof renderSolution>[1] = {}) => {
  const rendered = await renderSolution('regular', configProps);
  rendered.api.initFlow();
  await expectActivity(rendered.root, 'start-from');
  await delay(100);

  // The regular solution renders more than one drop area; this is the one inside the start-from dialog. The other is
  // a page-level fullscreen zone that defers to it (`_shouldIgnore`), so dropping on it does nothing.
  const dropArea = rendered.root.querySelector(
    '[data-testid="uc-modal"][id="start-from"] [data-testid="uc-drop-area"]',
  ) as HTMLElement;
  return { ...rendered, dropArea };
};

const transfer = (build: (data: DataTransfer) => void) => {
  const data = new DataTransfer();
  build(data);
  return data;
};

const dragOver = async (dropArea: HTMLElement) => {
  const rect = dropArea.getBoundingClientRect();
  document.body.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
  dropArea.dispatchEvent(
    new DragEvent('dragover', {
      bubbles: true,
      composed: true,
      clientX: rect.x + rect.width / 2,
      clientY: rect.y + rect.height / 2,
    }),
  );
  await delay(50);
};

describe('drag state', () => {
  it('starts inactive', async () => {
    const { dropArea } = await openStartFrom();

    expect(dropArea.getAttribute('drag-state')).toBe('inactive');
  });

  it('becomes active when a drag starts anywhere on the page', async () => {
    const { dropArea } = await openStartFrom();

    // `addDropzone` listens on document.body, not window.
    document.body.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
    await delay(50);

    expect(dropArea.getAttribute('drag-state')).toBe('active');
  });

  it('becomes over when the pointer is on the area', async () => {
    const { dropArea } = await openStartFrom();

    await dragOver(dropArea);

    expect(dropArea.getAttribute('drag-state')).toBe('over');
  });

  it('returns to inactive when the drag leaves', async () => {
    const { dropArea } = await openStartFrom();
    document.body.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
    await delay(50);

    document.body.dispatchEvent(new DragEvent('dragleave', { bubbles: true }));
    await delay(50);

    expect(dropArea.getAttribute('drag-state')).toBe('inactive');
  });

  it('resets when the window regains focus mid-drag', async () => {
    // A drag that ends outside the page never fires dragleave, so focus is the escape hatch.
    const { dropArea } = await openStartFrom();
    document.body.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
    await delay(50);

    window.dispatchEvent(new Event('focus'));
    await delay(50);

    expect(dropArea.getAttribute('drag-state')).toBe('inactive');
  });
});

/**
 * Drops carry urls rather than files here. A `DataTransfer` built in JS exposes `webkitGetAsEntry`, but it returns
 * null, and `getDropItems` takes that branch and skips the item rather than falling back to `getAsFile` — so a
 * synthetic file drop adds nothing, and a test written that way would pass for the wrong reason. The file path is
 * covered properly by the unit spec in `src/blocks/DropArea/getDropItems.test.ts`.
 */
describe('dropping', () => {
  const dropUrl = (dropArea: HTMLElement, url: string) => {
    dropArea.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        composed: true,
        dataTransfer: transfer((d) => d.items.add(url, 'text/uri-list')),
      }),
    );
  };

  it('adds a dropped url', async () => {
    const { dropArea, api } = await openStartFrom();

    dropUrl(dropArea, 'https://example.com/photo.jpg');

    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(1);
    expect(api.getOutputCollectionState().allEntries[0].externalUrl).toBe('https://example.com/photo.jpg');
  });

  it('ignores an empty drop', async () => {
    const { dropArea, api } = await openStartFrom();

    dropArea.dispatchEvent(new DragEvent('drop', { bubbles: true, composed: true, dataTransfer: new DataTransfer() }));
    await delay(300);

    expect(api.getOutputCollectionState().totalCount).toBe(0);
  });

  it('refuses a second item when multiple is off', async () => {
    const { dropArea, api } = await openStartFrom({ multiple: false });
    dropUrl(dropArea, 'https://example.com/first.jpg');
    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(1);

    dropUrl(dropArea, 'https://example.com/second.jpg');
    await delay(400);

    expect(api.getOutputCollectionState().totalCount).toBe(1);
  });

  it('refuses more items than multipleMax allows', async () => {
    const { dropArea, api } = await openStartFrom({ multiple: true, multipleMax: 1 });
    dropUrl(dropArea, 'https://example.com/first.jpg');
    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(1);

    dropUrl(dropArea, 'https://example.com/second.jpg');
    await delay(400);

    expect(api.getOutputCollectionState().totalCount).toBe(1);
  });
});

/**
 * `sourceList` keeps two entries so start-from actually renders: `initFlow` with a single source expands it and
 * navigates straight there instead of showing the picker.
 */
describe('when local uploads are not offered', () => {
  // QUIRK(drop-area): removing `local` from `sourceList` is supposed to hide the area — `_updateVisibility` keeps it
  // only when there is no default slot to hide (DropArea.ts:223). But visibility is computed from the `sourceList`
  // subscription, which fires before the element has rendered its slotted content, so `querySelector` finds nothing,
  // the area is judged slotless and stays visible. Nothing recomputes once the content appears. The result is a
  // visible "Drop files here" target that silently refuses every drop (the next test). Reproduced through the
  // attribute route too, so it is not a test-setup artefact. Pinned as current behaviour, not endorsed.
  it('stays visible even though it no longer accepts anything', async () => {
    const { dropArea } = await openStartFrom({ sourceList: 'url, camera' });

    await delay(300);
    expect(dropArea.hidden).toBe(false);
  });

  it('ignores a drop while disabled', async () => {
    const { root, api } = await openStartFrom({ sourceList: 'url, camera' });
    // Every area in the solution is disabled, so any of them proves the point — `.elements()` rather than `.query()`
    // because the strict locator refuses an ambiguous match, which is the behaviour worth keeping elsewhere.
    const [area] = within(root).getByTestId('uc-drop-area').elements();

    area.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        composed: true,
        dataTransfer: transfer((d) => d.items.add('https://example.com/photo.jpg', 'text/uri-list')),
      }),
    );
    await delay(400);

    expect(api.getOutputCollectionState().totalCount).toBe(0);
  });
});
