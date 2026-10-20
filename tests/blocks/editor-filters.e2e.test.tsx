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
 * Uses the same real uuid as the existing editor test: the filter previews are CDN URLs that have to load for the
 * thumbnails to appear.
 */

/** Renders a stand-alone editor and opens its Filters tab; the editor is not in any solution. */
const openFilters = async () => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-cloud-image-editor uuid="f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f" ctx-name={ctxName}></uc-cloud-image-editor>
      <uc-config cdn-cname="https://ucarecdn.com/" ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
  const editor = within(inCtx<HTMLElement>('uc-cloud-image-editor', ctxName));

  const tab = editor.getByRole('tab', { name: /filters/i });
  await expect.element(tab).toBeVisible();
  await userEvent.click(tab);

  const controls = () => editor.getByTestId('uc-editor-filter-control').elements();
  // The "original" entry has no test id of its own; the class is the only marker.
  const isOriginal = (control: Element) => control.querySelector('.uc-original-icon') !== null;
  const filters = () => controls().filter((control) => !isOriginal(control));
  const button = (control: Element) => control.querySelector('button') as HTMLElement;

  return { editor, controls, isOriginal, filters, button };
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
    const { controls, isOriginal } = await openFilters();
    await waitForControls(controls);

    expect(controls().filter(isOriginal)).toHaveLength(1);
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
    const { editor, controls, filters, button } = await openFilters();
    await waitForControls(controls);
    const filter = button(filters()[0]);

    await userEvent.click(filter);

    await expect.poll(() => filter.className).toContain('uc-active');
    await expect.element(editor.getByTestId('uc-editor-slider')).not.toBeVisible();
  });

  it('opens the strength slider on the second click', async () => {
    const { editor, controls, filters, button } = await openFilters();
    await waitForControls(controls);
    const filter = button(filters()[0]);

    await userEvent.click(filter);
    await expect.poll(() => filter.className).toContain('uc-active');
    await userEvent.click(filter);

    await expect.element(editor.getByTestId('uc-editor-slider')).toBeVisible();
  });

  it('never opens the slider for the original entry', async () => {
    const { editor, controls, isOriginal, button } = await openFilters();
    await waitForControls(controls);
    const original = button(controls().find(isOriginal) as Element);

    await userEvent.click(original);
    await userEvent.click(original);

    await expect.element(editor.getByTestId('uc-editor-slider')).not.toBeVisible();
  });

  it('switches the active filter when another is picked', async () => {
    const { controls, filters, button } = await openFilters();
    await waitForControls(controls, 2);

    const [first, second] = filters().map(button);
    await userEvent.click(first);
    await expect.poll(() => first.className).toContain('uc-active');

    await userEvent.click(second);

    await expect.poll(() => second.className).toContain('uc-active');
    await expect.poll(() => first.className).not.toContain('uc-active');
  });
});
