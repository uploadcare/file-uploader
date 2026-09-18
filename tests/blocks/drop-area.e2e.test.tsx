import { describe, expect, it } from 'vitest';
import { delay } from '@/utils/delay';
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
    // Negative wait: a drop that adds nothing fires no event, so give the async drop handler time to have run.
    await delay(300);

    expect(api.getOutputCollectionState().totalCount).toBe(0);
  });

  it('refuses a second item when multiple is off', async () => {
    const { dropArea, api } = await openStartFrom({ multiple: false });
    dropUrl(dropArea, 'https://example.com/first.jpg');
    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(1);

    dropUrl(dropArea, 'https://example.com/second.jpg');
    // Negative wait: the refused drop has no signal; the first drop landed well within this window.
    await delay(400);

    expect(api.getOutputCollectionState().totalCount).toBe(1);
  });

  it('refuses more items than multipleMax allows', async () => {
    const { dropArea, api } = await openStartFrom({ multiple: true, multipleMax: 1 });
    dropUrl(dropArea, 'https://example.com/first.jpg');
    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(1);

    dropUrl(dropArea, 'https://example.com/second.jpg');
    // Negative wait: the refused drop has no signal; the first drop landed well within this window.
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

    // Negative wait: pins that no later recompute hides the area; there is nothing to wait on.
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
    // Negative wait: a refused drop has no signal.
    await delay(400);

    expect(api.getOutputCollectionState().totalCount).toBe(0);
  });
});
