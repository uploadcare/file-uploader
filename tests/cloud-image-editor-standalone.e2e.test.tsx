import { beforeAll, describe, expect, it } from 'vitest';
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
});
