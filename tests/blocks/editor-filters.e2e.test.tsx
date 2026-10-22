import { EDITOR_IMAGE_UUID } from '@uploadcare/api-emulator';
import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { inCtx, within } from '~/tests/utils/render-solution';
import { getCtxName } from '~/tests/utils/test-renderer';
import '~/types/jsx';

/**
 * The editor's Filters tab. `tests/blocks/cloud-image-editor.e2e.test.tsx` covers crop and tuning, so
 * `EditorFilterControl` — the filter thumbnail buttons, their lazily previewed backgrounds and the slider they open —
 * sat at 3% coverage.
 *
 * Uses the emulator's seeded editor image, as the existing editor test does: the filter previews are CDN URLs that
 * have to load for the thumbnails to appear.
 */

/** Renders a stand-alone editor and opens its Filters tab; the editor is not in any solution. */
const openFilters = async () => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-cloud-image-editor uuid={EDITOR_IMAGE_UUID} ctx-name={ctxName}></uc-cloud-image-editor>
      <uc-config cdn-cname="https://ucarecdn.com/" ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
  const editor = within(inCtx<HTMLElement>('uc-cloud-image-editor', ctxName));

  const tab = editor.getByRole('tab', { name: /filters/i });
  await expect.element(tab).toBeVisible();
  await userEvent.click(tab);

  // Every entry in the strip is an option named "Apply <name> filter", the "original" entry included.
  const controls = () => editor.getByRole('option', { name: /^Apply .+ filter$/ }).elements();
  const original = editor.getByRole('option', { name: 'Apply original filter', exact: true });
  const filters = () => controls().filter((control) => control !== original.query());
  const isSelected = (control: Element) => control.getAttribute('aria-selected');

  return { editor, controls, original, filters, isSelected };
};

/** Waits for the strip to hold at least `min` entries; the list also holds an "original" entry that behaves differently. */
const waitForControls = async (controls: () => Element[], min = 1) => {
  await expect.poll(() => controls().length, { timeout: 20_000 }).toBeGreaterThan(min);
};

describe('editor filters tab', () => {
  it('lists the filters once the tab is opened', async () => {
    const { controls } = await openFilters();

    await waitForControls(controls);
  });

  it('offers an original entry alongside the filters', async () => {
    const { controls, original, filters } = await openFilters();
    await waitForControls(controls);

    await expect.element(original).toBeVisible();
    expect(filters().length).toBeGreaterThan(0);
  });

  it('loads a preview thumbnail for every filter', async () => {
    const { controls, filters } = await openFilters();
    await waitForControls(controls);

    // `_previewImage` becomes a CDN url with the filter applied, painted as the button's background. Previews are
    // fetched lazily on visibility, so each control is scrolled into view and awaited in turn — asserting the whole
    // strip at once would only ever prove that the handful on screen loaded.
    const hasPreview = (control: Element) => {
      const preview = page.elementLocator(control).getByTestId('uc-editor-filter-control--preview').query();
      return /^url\("https:\/\/ucarecdn\.com\//.test((preview as HTMLElement | null)?.style.backgroundImage ?? '');
    };

    for (const control of filters()) {
      control.scrollIntoView({ block: 'nearest', inline: 'center' });
      await expect.poll(() => hasPreview(control), { timeout: 20_000 }).toBe(true);
    }
  });

  /**
   * Filters take two clicks: the first applies the filter outright, the second opens the strength slider for the
   * already-active one (EditorFilterControl.ts:62).
   */
  it('applies the filter on the first click', async () => {
    const { editor, controls, filters, isSelected } = await openFilters();
    await waitForControls(controls);
    const [filter] = filters();

    await userEvent.click(filter);

    await expect.poll(() => isSelected(filter)).toBe('true');
    await expect.element(editor.getByTestId('uc-editor-slider')).not.toBeVisible();
  });

  it('opens the strength slider on the second click', async () => {
    const { editor, controls, filters, isSelected } = await openFilters();
    await waitForControls(controls);
    const [filter] = filters();

    await userEvent.click(filter);
    await expect.poll(() => isSelected(filter)).toBe('true');
    await userEvent.click(filter);

    await expect.element(editor.getByTestId('uc-editor-slider')).toBeVisible();
  });

  it('never opens the slider for the original entry', async () => {
    const { editor, controls, original } = await openFilters();
    await waitForControls(controls);

    await userEvent.click(original);
    await userEvent.click(original);

    await expect.element(editor.getByTestId('uc-editor-slider')).not.toBeVisible();
  });

  it('switches the active filter when another is picked', async () => {
    const { controls, filters, isSelected } = await openFilters();
    await waitForControls(controls, 2);

    const [first, second] = filters();
    await userEvent.click(first);
    await expect.poll(() => isSelected(first)).toBe('true');

    await userEvent.click(second);

    await expect.poll(() => isSelected(second)).toBe('true');
    await expect.poll(() => isSelected(first)).toBe('false');
  });
});
