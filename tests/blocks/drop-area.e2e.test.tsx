import { describe, expect, it } from 'vitest';
import { expectActivity, modalDialog, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * `<uc-drop-area>` and its `addDropzone` helper. `tests/solutions/minimal.e2e.test.tsx` drops one file; the drag
 * state machine, the url branch and the rules that switch the area off had no coverage.
 */

const openStartFrom = async (configProps: Parameters<typeof renderSolution>[1] = {}) => {
  const rendered = await renderSolution('regular', configProps);
  rendered.api.initFlow();
  await expectActivity(rendered.root, 'start-from');

  // The regular solution renders more than one drop area; this is the one inside the start-from dialog. The other is
  // a page-level fullscreen zone that defers to it (`_shouldIgnore`), so dropping on it does nothing.
  const dialog = modalDialog(rendered.root, 'start-from') as HTMLDialogElement;
  const dropArea = within(dialog).getByTestId('uc-drop-area');
  // The dropzone is wired up in `connectedCallback` and publishes its state as `drag-state`; wait for that first.
  await expect.poll(() => dropArea.query()?.hasAttribute('drag-state')).toBe(true);
  const dragState = () => dropArea.element().getAttribute('drag-state');

  return { ...rendered, dropArea: dropArea.element() as HTMLElement, dragState };
};

const transfer = (build: (data: DataTransfer) => void) => {
  const data = new DataTransfer();
  build(data);
  return data;
};

/** The dropped urls in the collection, in order. */
const droppedUrls = (api: Awaited<ReturnType<typeof openStartFrom>>['api']) =>
  api.getOutputCollectionState().allEntries.map((entry) => entry.externalUrl);

const dragOver = (dropArea: HTMLElement) => {
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
};

describe('drag state', () => {
  it('starts inactive', async () => {
    const { dragState } = await openStartFrom();

    expect(dragState()).toBe('inactive');
  });

  it('becomes active when a drag starts anywhere on the page', async () => {
    const { dragState } = await openStartFrom();

    // `addDropzone` listens on document.body, not window.
    document.body.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));

    await expect.poll(dragState).toBe('active');
  });

  it('becomes over when the pointer is on the area', async () => {
    const { dropArea, dragState } = await openStartFrom();

    dragOver(dropArea);

    await expect.poll(dragState).toBe('over');
  });

  it('returns to inactive when the drag leaves', async () => {
    const { dragState } = await openStartFrom();
    document.body.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
    await expect.poll(dragState).toBe('active');

    document.body.dispatchEvent(new DragEvent('dragleave', { bubbles: true }));

    await expect.poll(dragState).toBe('inactive');
  });

  it('resets when the window regains focus mid-drag', async () => {
    // A drag that ends outside the page never fires dragleave, so focus is the escape hatch.
    const { dragState } = await openStartFrom();
    document.body.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
    await expect.poll(dragState).toBe('active');

    window.dispatchEvent(new Event('focus'));

    await expect.poll(dragState).toBe('inactive');
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
    // The sentinel: a drop that does add goes through the same async handler, after the empty one.
    dropUrl(dropArea, 'https://example.com/sentinel.jpg');

    await expect.poll(() => droppedUrls(api)).toEqual(['https://example.com/sentinel.jpg']);
  });

  it('refuses a second item when multiple is off', async () => {
    const { dropArea, api } = await openStartFrom({ multiple: false });
    dropUrl(dropArea, 'https://example.com/first.jpg');
    await expect.poll(() => droppedUrls(api)).toEqual(['https://example.com/first.jpg']);

    dropUrl(dropArea, 'https://example.com/second.jpg');
    // The sentinel: with the first file gone the area accepts again, and its drop lands after the refused one.
    api.removeFileByInternalId(api.getOutputCollectionState().allEntries[0].internalId);
    dropUrl(dropArea, 'https://example.com/sentinel.jpg');

    await expect.poll(() => droppedUrls(api)).toEqual(['https://example.com/sentinel.jpg']);
  });

  it('refuses more items than multipleMax allows', async () => {
    const { dropArea, api } = await openStartFrom({ multiple: true, multipleMax: 1 });
    dropUrl(dropArea, 'https://example.com/first.jpg');
    await expect.poll(() => droppedUrls(api)).toEqual(['https://example.com/first.jpg']);

    dropUrl(dropArea, 'https://example.com/second.jpg');
    // The sentinel: with the first file gone the area accepts again, and its drop lands after the refused one.
    api.removeFileByInternalId(api.getOutputCollectionState().allEntries[0].internalId);
    dropUrl(dropArea, 'https://example.com/sentinel.jpg');

    await expect.poll(() => droppedUrls(api)).toEqual(['https://example.com/sentinel.jpg']);
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

    // The slotted content the visibility check looks for has rendered, and the area is still visible.
    await expect.poll(() => dropArea.querySelector('[data-default-slot]')).not.toBeNull();
    expect(dropArea.hidden).toBe(false);
  });

  it('ignores a drop while disabled', async () => {
    const { root, api, config } = await openStartFrom({ sourceList: 'url, camera' });
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
    // The sentinel: with local uploads back the area accepts, and its drop lands after the refused one.
    config.sourceList = 'local, url, camera';
    area.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        composed: true,
        dataTransfer: transfer((d) => d.items.add('https://example.com/sentinel.jpg', 'text/uri-list')),
      }),
    );

    await expect.poll(() => droppedUrls(api)).toEqual(['https://example.com/sentinel.jpg']);
  });
});
