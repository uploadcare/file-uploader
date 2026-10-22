import { describe, expect, it } from 'vitest';
import type { IconHrefResolver } from '@/index';
import { IMAGE } from '~/tests/fixtures/files';
import { recordEvents } from '~/tests/utils/event-recorder';
import { expectActivity, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/** Documented options whose whole effect is on what the uploader renders; `cdn-cname.e2e` covers `cdnCname`. */

describe('removeCopyright', () => {
  it('shows the credit by default', async () => {
    const { root, api } = await renderSolution('regular');
    api.initFlow();
    await expectActivity(root, 'start-from');

    await expect.poll(() => within(root).getByTestId('uc-copyright').query()?.hasAttribute('hidden')).toBe(false);
  });

  it('hides the credit when set', async () => {
    const { root, api } = await renderSolution('regular', { removeCopyright: true });
    api.initFlow();
    await expectActivity(root, 'start-from');

    await expect.poll(() => within(root).getByTestId('uc-copyright').query()?.hasAttribute('hidden')).toBe(true);
  });
});

describe('showEmptyList', () => {
  it('keeps the empty upload list out of the inline solution by default', async () => {
    const { root, api, provider } = await renderSolution('inline');
    await expectActivity(root, 'start-from');
    const recorder = recordEvents(provider);

    // The sentinel: a file opens the list through the same subscription that would open an empty one.
    api.addFileFromObject(IMAGE.PIXEL);
    await expectActivity(root, 'upload-list');

    expect(
      recorder.events
        .filter((event) => event.type === 'file-added' || event.type === 'activity-change')
        .map((event) =>
          event.type === 'activity-change' ? (event.detail as { activity: string }).activity : event.type,
        ),
    ).toEqual(['file-added', 'upload-list']);
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
    const { root, api, provider } = await renderSolution('inline');
    await expectActivity(root, 'start-from');
    const recorder = recordEvents(provider);

    api.setCurrentActivity('upload-list');

    // The list opens and hands straight back: start-from coming back after it is the end of the bounce.
    await expect
      .poll(() => recorder.detailsOf('activity-change').map((detail) => detail.activity))
      .toEqual(['upload-list', 'start-from']);
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

    await expect.poll(() => within(root).getByTestId('uc-upload-list').query()?.getAttribute('mode')).toBe('list');
    await expect.poll(() => within(root).getByTestId('uc-file-item').query()?.getAttribute('mode')).toBe('list');
  });

  it('switches the list and its items to grid mode', async () => {
    const { root, api } = await renderSolution('regular', { filesViewMode: 'grid' });
    api.addFileFromObject(IMAGE.PIXEL);
    api.initFlow();
    await expectActivity(root, 'upload-list');

    await expect.poll(() => within(root).getByTestId('uc-upload-list').query()?.getAttribute('mode')).toBe('grid');
    await expect.poll(() => within(root).getByTestId('uc-file-item').query()?.getAttribute('mode')).toBe('grid');
  });
});

describe('gridShowFileNames', () => {
  /** The name is always in the DOM; the option toggles `hidden` on it (FileItem.ts:557). */
  const fileName = async (configProps: Parameters<typeof renderSolution>[1]) => {
    const { root, api } = await renderSolution('regular', configProps);
    api.addFileFromObject(IMAGE.PIXEL);
    api.initFlow();
    await expectActivity(root, 'upload-list');

    const name = within(root).getByTestId('uc-file-item--file-name');
    // The file item renders its inner template a beat after the list becomes active.
    await expect.element(name).toHaveTextContent('pixel.jpg');
    return name;
  };

  it('hides names in grid mode by default', async () => {
    await expect.element(await fileName({ filesViewMode: 'grid' })).toHaveAttribute('hidden');
  });

  it('shows names in grid mode when set', async () => {
    await expect
      .element(await fileName({ filesViewMode: 'grid', gridShowFileNames: true }))
      .not.toHaveAttribute('hidden');
  });

  it('is ignored in list mode, where names always show', async () => {
    // `_updateShowFileNames` short-circuits for list mode (FileItem.ts:266), so the option only means anything in
    // grid mode — the docs describe it as grid-only and the code agrees.
    await expect
      .element(await fileName({ filesViewMode: 'list', gridShowFileNames: false }))
      .not.toHaveAttribute('hidden');
  });
});

describe('iconHrefResolver', () => {
  it('uses the built-in sprite reference by default', async () => {
    const { root, api } = await renderSolution('regular');
    api.initFlow();
    await expectActivity(root, 'start-from');

    await expect
      .poll(() => root.querySelector('[data-testid="uc-icon"] use')?.getAttribute('href'))
      .toMatch(/^#uc-icon-/);
  });

  it('takes the href the resolver returns', async () => {
    const { root, api } = await renderSolution('regular', {
      iconHrefResolver: (name: string) => `https://icons.example.com/${name}.svg#icon`,
    });
    api.initFlow();
    await expectActivity(root, 'start-from');

    await expect
      .poll(() => root.querySelector('[data-testid="uc-icon"] use')?.getAttribute('href'))
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

    await expect
      .poll(() => root.querySelector('[data-testid="uc-icon"] use')?.getAttribute('href'))
      .toMatch(/^#uc-icon-/);
  });
});

describe('localeDefinitionOverride', () => {
  it('replaces a single string for the active locale', async () => {
    const { root, api } = await renderSolution('regular', {
      localeDefinitionOverride: { en: { 'start-from-cancel': 'Never mind' } },
    });
    api.initFlow();
    await expectActivity(root, 'start-from');

    await expect
      .element(within(root).getByTestId('uc-start-from').getByText('Never mind', { exact: true }))
      .toBeVisible();
  });

  it('leaves strings it does not name alone', async () => {
    const { root, api } = await renderSolution('regular', {
      localeDefinitionOverride: { en: { 'start-from-cancel': 'Never mind' } },
    });
    api.initFlow();
    await expectActivity(root, 'start-from');

    await expect
      .element(within(root).getByTestId('uc-start-from').getByRole('button', { name: 'From link', exact: true }))
      .toBeVisible();
  });

  it('ignores an override aimed at a different locale', async () => {
    const { root, api } = await renderSolution('regular', {
      localeDefinitionOverride: { fr: { 'start-from-cancel': 'Annuler' } },
    });
    api.initFlow();
    await expectActivity(root, 'start-from');

    await expect
      .element(within(root).getByTestId('uc-start-from').getByRole('button', { name: 'Cancel', exact: true }))
      .toBeVisible();
  });
});
