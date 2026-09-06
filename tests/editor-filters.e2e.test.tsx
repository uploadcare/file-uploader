import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { getCtxName } from './utils/test-renderer';
import '../types/jsx';

/**
 * The editor's Filters tab. `tests/cloud-image-editor.e2e.test.tsx` covers crop and tuning, so
 * `EditorFilterControl` — the filter thumbnail buttons, their lazily previewed backgrounds and the slider they open —
 * sat at 3% coverage.
 *
 * Uses the same real uuid as the existing editor test: the filter previews are CDN URLs that have to load for the
 * thumbnails to appear.
 */

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(() => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-cloud-image-editor uuid="f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f" ctx-name={ctxName}></uc-cloud-image-editor>
      <uc-config cdn-cname="https://ucarecdn.com/" ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
});

const openFilters = async () => {
  const tab = page.getByRole('tab', { name: /filters/i });
  await expect.element(tab).toBeVisible();
  await userEvent.click(tab);
};

const filterControls = () => document.querySelectorAll('uc-editor-filter-control');

/** The first real filter — the list also holds an "original" entry that behaves differently. */
const pickFilter = async () => {
  await expect.poll(() => filterControls().length, { timeout: 20_000 }).toBeGreaterThan(1);
  const filter = [...filterControls()].find((control) => !control.querySelector('.uc-original-icon'));
  if (!filter) {
    throw new Error('No filter controls rendered');
  }
  return filter;
};

describe('editor filters tab', () => {
  it('lists the filters once the tab is opened', async () => {
    await openFilters();

    await expect.poll(() => filterControls().length, { timeout: 20_000 }).toBeGreaterThan(1);
  });

  it('offers an original entry alongside the filters', async () => {
    await openFilters();
    await expect.poll(() => filterControls().length, { timeout: 20_000 }).toBeGreaterThan(1);

    const originals = [...filterControls()].filter((control) => control.querySelector('.uc-original-icon'));
    expect(originals).toHaveLength(1);
  });

  it('loads a preview thumbnail for each filter', async () => {
    await openFilters();

    // `_previewImage` becomes a CDN url with the filter applied, painted as the button's background.
    await expect
      .poll(
        () => {
          const previews = [...filterControls()].map((c) => c.querySelector<HTMLElement>('.uc-preview'));
          return previews.filter((p) => p?.style.backgroundImage.includes('ucarecdn.com')).length;
        },
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0);
  });

  /**
   * Filters take two clicks: the first applies the filter outright, the second opens the strength slider for the
   * already-active one (EditorFilterControl.ts:62).
   */
  it('applies the filter on the first click', async () => {
    await openFilters();
    const filter = await pickFilter();

    await userEvent.click(filter.querySelector('button') as HTMLElement);

    await expect.poll(() => filter.querySelector('button')?.className).toContain('uc-active');
    await expect.element(page.getByTestId('uc-editor-slider')).not.toBeVisible();
  });

  it('opens the strength slider on the second click', async () => {
    await openFilters();
    const filter = await pickFilter();
    const button = filter.querySelector('button') as HTMLElement;

    await userEvent.click(button);
    await expect.poll(() => button.className).toContain('uc-active');
    await userEvent.click(button);

    await expect.element(page.getByTestId('uc-editor-slider')).toBeVisible();
  });

  it('never opens the slider for the original entry', async () => {
    await openFilters();
    await expect.poll(() => filterControls().length, { timeout: 20_000 }).toBeGreaterThan(1);
    const original = [...filterControls()].find((control) => control.querySelector('.uc-original-icon'));
    const button = original?.querySelector('button') as HTMLElement;

    await userEvent.click(button);
    await userEvent.click(button);

    await expect.element(page.getByTestId('uc-editor-slider')).not.toBeVisible();
  });

  it('switches the active filter when another is picked', async () => {
    await openFilters();
    await expect.poll(() => filterControls().length, { timeout: 20_000 }).toBeGreaterThan(2);

    const [first, second] = [...filterControls()].filter((c) => !c.querySelector('.uc-original-icon'));
    await userEvent.click(first.querySelector('button') as HTMLElement);
    await expect.poll(() => first.querySelector('button')?.className).toContain('uc-active');

    await userEvent.click(second.querySelector('button') as HTMLElement);

    await expect.poll(() => second.querySelector('button')?.className).toContain('uc-active');
    await expect.poll(() => first.querySelector('button')?.className).not.toContain('uc-active');
  });
});
