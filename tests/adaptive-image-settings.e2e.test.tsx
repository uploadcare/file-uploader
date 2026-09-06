import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import '../types/jsx';

/**
 * `<uc-img>` builds a CDN URL from its documented settings (adaptive-image.mdx, "Settings"). Nothing asserted any of
 * it — `tests/adaptive-image.e2e.test.tsx` renders the element with its only expectation commented out.
 *
 * Assertions are on the generated `src` / `srcset`. The `@clib/blocks/<version>/uc-img/` marker the component appends
 * carries the package version, so it is matched loosely rather than pinned.
 */

const UUID = '7124ae98-344c-42b2-ae2a-bd9aa79d76d8';

beforeAll(async () => {
  await import('@/solutions/adaptive-image/index.js');
});

/** Renders one `<uc-img>` and waits for the real image, which is when `srcset` appears. */
const renderImg = async (attrs: string) => {
  page.render(<div data-testid="img-host"></div>);
  const host = page.getByTestId('img-host').element();
  host.innerHTML = `<uc-img uuid="${UUID}" ${attrs}></uc-img>`;

  const img = () => host.querySelector('img');
  await expect.poll(() => img()?.getAttribute('srcset') ?? '', { timeout: 20_000 }).not.toBe('');

  return {
    src: img()?.getAttribute('src') ?? '',
    srcset: img()?.getAttribute('srcset') ?? '',
    descriptors: (img()?.getAttribute('srcset') ?? '')
      .split(',')
      .map((entry) => entry.trim().split(' ')[1])
      .filter(Boolean),
  };
};

describe('uc-img url building', () => {
  it('builds a CDN url from the uuid', async () => {
    const { src } = await renderImg('width="500px"');

    expect(src).toMatch(new RegExp(`^https://ucarecdn\\.com/${UUID}/-/@clib/blocks/[^/]+/uc-img/$`));
  });

  it('adds a resize operation per pixel density', async () => {
    const { srcset, descriptors } = await renderImg('width="500px"');

    expect(descriptors).toEqual(['1x', '2x']);
    expect(srcset).toContain('/-/resize/500x/');
    expect(srcset).toContain('/-/resize/1000x/');
  });

  it('drops the 2x entry when hi-res support is switched off through the CSS property', async () => {
    const { descriptors } = await renderImg('width="500px" style="--uc-img-hi-res-support: 0"');

    expect(descriptors).toEqual(['1x']);
  });

  // QUIRK(uc-img): adaptive-image.mdx gives every setting both a CSS context property and an HTML attribute, but the
  // "number flag" ones cannot be switched off through the attribute. `$$('hi-res-support')` returns the *string*
  // `"0"` for the attribute form and the *number* `0` for the CSS one, and `_getSrcset` only tests truthiness
  // (ImgBase.ts:241) — so `hi-res-support="0"` still emits the 2x entry. The same applies to every documented number
  // flag: dev-mode, lazy, intersection, ultra-res-support, progressive, is-preview-blur.
  // Pinned as current behaviour, not endorsed.
  it('ignores the attribute form of the same switch', async () => {
    const { descriptors } = await renderImg('width="500px" hi-res-support="0"');

    expect(descriptors).toEqual(['1x', '2x']);
  });

  it('adds a 3x entry with ultra-res support', async () => {
    const { descriptors } = await renderImg('width="500px" ultra-res-support="1"');

    expect(descriptors).toContain('3x');
  });

  it('uses width descriptors when breakpoints are given', async () => {
    const { srcset, descriptors } = await renderImg('breakpoints="200,400"');

    // Each breakpoint also gets a doubled entry from the default hi-res support, and the set is de-duplicated —
    // 400w is both the second breakpoint and twice the first, so four candidates collapse to three.
    expect(descriptors).toEqual(['200w', '400w', '800w']);
    expect(srcset).toContain('/-/resize/200x/');
    expect(srcset).toContain('/-/resize/400x/');
    expect(srcset).toContain('/-/resize/800x/');
  });

  it('applies the format operation', async () => {
    const { src } = await renderImg('width="500px" format="avif"');

    expect(src).toContain('/-/format/avif/');
  });

  it('applies the quality operation', async () => {
    const { src } = await renderImg('width="500px" quality="lighter"');

    expect(src).toContain('/-/quality/lighter/');
  });

  it('keeps caller-supplied cdn operations', async () => {
    const { src, srcset } = await renderImg('width="500px" cdn-operations="-/grayscale/"');

    expect(src).toContain('/-/grayscale/');
    // The resize the component adds for each density sits alongside them rather than replacing them.
    expect(srcset).toContain('/-/resize/500x/-/grayscale/');
  });

  it('combines format, quality and custom operations', async () => {
    const { src } = await renderImg('width="500px" format="avif" quality="lighter" cdn-operations="-/grayscale/"');

    expect(src).toContain('/-/format/avif/');
    expect(src).toContain('/-/quality/lighter/');
    expect(src).toContain('/-/grayscale/');
  });
});
