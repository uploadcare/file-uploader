import { beforeAll, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('Cloud Image Editor — standalone (no <uc-config>)', () => {
  it('renders with its own cdn-cname + bundled English locale + icons, cropper activates', async () => {
    // No sibling <uc-config>: config comes from the editor's own props, locale
    // from the vendored English default. `test-mode` (own prop) drives the
    // data-testid used by getByTestId.
    page.render(
      <uc-cloud-image-editor
        uuid="f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f"
        cdn-cname="https://ucarecdn.com/"
        test-mode
      ></uc-cloud-image-editor>,
    );

    await expect.element(page.getByTestId('uc-cloud-image-editor')).toBeVisible();

    // Cropper activates (image drawn) with no uc-config present.
    await expect.poll(() => document.querySelector('uc-editor-image-cropper')?.className).toMatch(/uc-active_from_/);

    // Icons render (uc-editor-icon sprite <use>, ctx-free).
    await expect
      .poll(() => [...document.querySelectorAll('uc-editor-icon')].some((i) => i.querySelector('svg use')))
      .toBe(true);

    // Bundled English locale resolves (the interpolated tuning a11y name).
    await userEvent.click(page.getByRole('tab', { name: /tuning/i }));
    await expect.element(page.getByRole('option', { name: /Brightness/i })).toBeVisible();
  });

  it('warns and opens without transformations when cdn-url addresses a group rather than a single file', async () => {
    // `parseFileUrl` (used by `updateImage`'s read path) throws for anything
    // that isn't a single stored file — a group URL here — and the editor's
    // local catch must turn that into a warning, not an unhandled rejection,
    // while still rendering (no transformations applied).
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      page.render(
        <uc-cloud-image-editor
          cdn-url="https://ucarecdn.com/f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f~3/"
          cdn-cname="https://ucarecdn.com/"
          test-mode
        ></uc-cloud-image-editor>,
      );

      await expect.element(page.getByTestId('uc-cloud-image-editor')).toBeVisible();

      await expect.poll(() => warnSpy.mock.calls.length).toBeGreaterThan(0);
      expect(warnSpy).toHaveBeenCalledWith(
        '[uc][cloud-image-editor]',
        'Failed to parse CDN URL, opening editor without transformations',
        expect.any(Error),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
