import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { IconHrefResolver } from '@/index';
import { delay } from '@/utils/delay';
import { IMAGE } from './fixtures/files';
import { expectActivity, renderSolution } from './utils/render-solution';
import '../types/jsx';

/**
 * Documented options whose whole effect is on what the uploader renders. `tests/config.e2e.test.tsx` covers
 * `cdnCname` resolution; this covers the rest of the UI-facing set, which had no tests at all.
 *
 * A separate file rather than an addition to config.e2e: that file's `beforeEach` renders its own fixture, and
 * `page.render` appends instead of replacing, so a second render inside a test would leave two uploaders on the page
 * and break every `getByTestId` on strict mode.
 */

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('removeCopyright', () => {
  it('shows the credit by default', async () => {
    const { root, api } = await renderSolution('regular');
    api.initFlow();
    await expectActivity(root, 'start-from');

    await expect.poll(() => root.querySelector('uc-copyright')?.hasAttribute('hidden')).toBe(false);
  });

  it('hides the credit when set', async () => {
    const { root, api } = await renderSolution('regular', { removeCopyright: true });
    api.initFlow();
    await expectActivity(root, 'start-from');

    await expect.poll(() => root.querySelector('uc-copyright')?.hasAttribute('hidden')).toBe(true);
  });
});

describe('showEmptyList', () => {
  it('keeps the empty upload list out of the inline solution by default', async () => {
    const { root } = await renderSolution('inline');
    await expectActivity(root, 'start-from');

    await delay(100);
    expect(root.querySelector('uc-upload-list')?.hasAttribute('active')).toBe(false);
  });

  it('lets the empty upload list open when set', async () => {
    // `UploadList.couldOpenActivity` is `showEmptyList || size > 0` (UploadList.ts:178); without it the activity
    // bounces straight back to the init activity.
    const { root, api } = await renderSolution('inline', { showEmptyList: true });
    await expectActivity(root, 'start-from');

    api.setCurrentActivity('upload-list');

    await expectActivity(root, 'upload-list');
  });

  it('bounces the empty upload list back to start-from when not set', async () => {
    const { root, api } = await renderSolution('inline');
    await expectActivity(root, 'start-from');

    api.setCurrentActivity('upload-list');

    await delay(300);
    await expectActivity(root, 'start-from');
    expect(api.getCurrentActivity()).toBe('start-from');
  });
});

describe('filesViewMode', () => {
  it('defaults to list mode', async () => {
    const { root, api } = await renderSolution('regular');
    api.addFileFromObject(IMAGE.PIXEL);
    api.initFlow();
    await expectActivity(root, 'upload-list');

    await expect.poll(() => root.querySelector('uc-upload-list')?.getAttribute('mode')).toBe('list');
    await expect.poll(() => root.querySelector('uc-file-item')?.getAttribute('mode')).toBe('list');
  });

  it('switches the list and its items to grid mode', async () => {
    const { root, api } = await renderSolution('regular', { filesViewMode: 'grid' });
    api.addFileFromObject(IMAGE.PIXEL);
    api.initFlow();
    await expectActivity(root, 'upload-list');

    await expect.poll(() => root.querySelector('uc-upload-list')?.getAttribute('mode')).toBe('grid');
    await expect.poll(() => root.querySelector('uc-file-item')?.getAttribute('mode')).toBe('grid');
  });
});

describe('gridShowFileNames', () => {
  /** The name is always in the DOM; the option toggles `hidden` on it (FileItem.ts:557). */
  const fileNameVisible = async (configProps: Parameters<typeof renderSolution>[1]) => {
    const { root, api } = await renderSolution('regular', configProps);
    api.addFileFromObject(IMAGE.PIXEL);
    api.initFlow();
    await expectActivity(root, 'upload-list');

    const name = () => root.querySelector<HTMLElement>('uc-file-item .uc-file-name');
    // The file item renders its inner template a beat after the list becomes active.
    await expect.poll(() => name()?.textContent).toBe('pixel.jpg');

    return !name()?.hidden;
  };

  it('hides names in grid mode by default', async () => {
    expect(await fileNameVisible({ filesViewMode: 'grid' })).toBe(false);
  });

  it('shows names in grid mode when set', async () => {
    expect(await fileNameVisible({ filesViewMode: 'grid', gridShowFileNames: true })).toBe(true);
  });

  it('is ignored in list mode, where names always show', async () => {
    // `_updateShowFileNames` short-circuits for list mode (FileItem.ts:266), so the option only means anything in
    // grid mode — the docs describe it as grid-only and the code agrees.
    expect(await fileNameVisible({ filesViewMode: 'list', gridShowFileNames: false })).toBe(true);
  });
});

describe('iconHrefResolver', () => {
  it('uses the built-in sprite reference by default', async () => {
    const { root, api } = await renderSolution('regular');
    api.initFlow();
    await expectActivity(root, 'start-from');

    await expect.poll(() => root.querySelector('uc-icon use')?.getAttribute('href')).toMatch(/^#uc-icon-/);
  });

  it('takes the href the resolver returns', async () => {
    const { root, api } = await renderSolution('regular', {
      iconHrefResolver: (name: string) => `https://icons.example.com/${name}.svg#icon`,
    });
    api.initFlow();
    await expectActivity(root, 'start-from');

    await expect
      .poll(() => root.querySelector('uc-icon use')?.getAttribute('href'))
      .toMatch(/^https:\/\/icons\.example\.com\/.+\.svg#icon$/);
  });

  // QUIRK(types): options.mdx says "If nothing is returned, the default icon sprite will be used", and
  // `Icon._updateResolvedHref` implements exactly that (`customHref ?? defaultHref`) — but the published type is
  // `IconHrefResolver = (iconName: string) => string` (types/exported.ts:46), so a TypeScript user cannot write the
  // documented resolver without a cast. The cast below exists only to express that gap. Pinned, not endorsed.
  it('falls back to the default href when the resolver returns undefined', async () => {
    const resolver = (() => undefined) as unknown as IconHrefResolver;
    const { root, api } = await renderSolution('regular', { iconHrefResolver: resolver });
    api.initFlow();
    await expectActivity(root, 'start-from');

    await expect.poll(() => root.querySelector('uc-icon use')?.getAttribute('href')).toMatch(/^#uc-icon-/);
  });
});

describe('localeDefinitionOverride', () => {
  it('replaces a single string for the active locale', async () => {
    const { root, api } = await renderSolution('regular', {
      localeDefinitionOverride: { en: { 'start-from-cancel': 'Never mind' } },
    });
    api.initFlow();
    await expectActivity(root, 'start-from');

    await expect.element(page.getByTestId('uc-start-from').getByText('Never mind', { exact: true })).toBeVisible();
  });

  it('leaves strings it does not name alone', async () => {
    const { root, api } = await renderSolution('regular', {
      localeDefinitionOverride: { en: { 'start-from-cancel': 'Never mind' } },
    });
    api.initFlow();
    await expectActivity(root, 'start-from');

    await expect.element(page.getByTestId('uc-start-from').getByText('From link', { exact: true })).toBeVisible();
  });

  it('ignores an override aimed at a different locale', async () => {
    const { root, api } = await renderSolution('regular', {
      localeDefinitionOverride: { fr: { 'start-from-cancel': 'Annuler' } },
    });
    api.initFlow();
    await expectActivity(root, 'start-from');

    await expect.element(page.getByTestId('uc-start-from').getByText('Cancel', { exact: true })).toBeVisible();
  });
});
