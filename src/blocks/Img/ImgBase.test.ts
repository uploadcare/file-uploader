import { describe, expect, it } from 'vitest';
import { DEV_MODE, MAX_WIDTH, MAX_WIDTH_JPG } from './configurations';
import { ImgBase } from './ImgBase';
import { PROPS_MAP } from './props-map';

/**
 * Characterisation tests for `<uc-img>`'s CDN URL construction, pinning the
 * CURRENT behaviour before it is rebuilt on `@uploadcare/cdn-url`. The element
 * had no unit coverage at all, and `_getUrlBase` has five branches whose output
 * is the user-visible `src`/`srcset`, so this is the safety net for that work.
 *
 * `_getUrlBase` is private and reads config through `$$`, which normally comes
 * from CSS custom properties (unavailable in happy-dom). The stub below mirrors
 * `ImgConfig`'s own initialisation — every `PROPS_MAP` key present, set to its
 * declared default or `''` — so the fixtures behave like a real element rather
 * than like a bag of nulls (`$$` returning null would put `format/null` in URLs,
 * which cannot happen in production).
 */
class TestImgBase extends ImgBase {}
TestImgBase.reg('uc-test-img-base');

type UrlBaseAccess = {
  _getUrlBase(size?: string | null, blur?: string | null): string | undefined;
  _getSrcset(): string;
  _getSrc(): string | undefined;
  _srcUrlPreview: string | undefined;
  $$: (key: string) => unknown;
  analyticsParams: () => string;
};

const ANALYTICS = '-/@clib/test/1.0/uc-img/';
/** A real UUID: the library validates the grammar, so placeholders are rejected. */
const UUID = 'c2499162-eb07-4b93-b31e-94a89a47e858';

/** Config as `ImgConfig` would hold it: declared defaults, `''` for the rest. */
const withDefaults = (config: Record<string, unknown>): Record<string, unknown> => ({
  ...Object.fromEntries(
    Object.entries(PROPS_MAP).map(([key, cfg]) => [key, (cfg as { default?: unknown }).default ?? '']),
  ),
  ...config,
});

const makeImg = (config: Record<string, unknown>): UrlBaseAccess => {
  const resolved = withDefaults(config);
  const el = document.createElement('uc-test-img-base') as unknown as UrlBaseAccess;
  el.$$ = (key: string) => resolved[key];
  // Pinned so assertions don't depend on build-time package version injection.
  el.analyticsParams = () => ANALYTICS;
  return el;
};

describe('environment assumptions', () => {
  it('runs with DEV_MODE on, because it is derived from window.location at module load', () => {
    // Documented so the relative-src expectations below are not mistaken for
    // production behaviour: under a real host, DEV_MODE is false and relative
    // sources get absolutised via `_fmtAbs` instead.
    expect(DEV_MODE).toBe(true);
  });

  it('defaults cdn-cname to the Uploadcare CDN', () => {
    expect((PROPS_MAP['cdn-cname'] as { default: string }).default).toBe('https://ucarecdn.com');
  });
});

describe('_getUrlBase — passthrough sources', () => {
  it('returns a data: URL untouched', () => {
    expect(makeImg({ src: 'data:image/png;base64,AAA' })._getUrlBase()).toBe('data:image/png;base64,AAA');
  });

  it('returns a blob: URL untouched', () => {
    expect(makeImg({ src: 'blob:http://x/y' })._getUrlBase()).toBe('blob:http://x/y');
  });

  it('returns a relative source untouched under DEV_MODE', () => {
    expect(makeImg({ src: 'local/pic.png' })._getUrlBase()).toBe('local/pic.png');
  });

  it('returns undefined when nothing identifies a file', () => {
    expect(makeImg({ src: '' })._getUrlBase()).toBeUndefined();
  });
});

describe('_getUrlBase — CDN branches', () => {
  it('appends modifiers to a src that already sits on the configured cname', () => {
    const el = makeImg({ src: `https://cdn.example.com/${UUID}/`, 'cdn-cname': 'https://cdn.example.com' });

    expect(el._getUrlBase()).toBe(`https://cdn.example.com/${UUID}/${ANALYTICS}`);
  });

  it('builds from cname + uuid', () => {
    const el = makeImg({ src: '', 'cdn-cname': 'https://cdn.example.com', uuid: UUID });

    expect(el._getUrlBase()).toBe(`https://cdn.example.com/${UUID}/${ANALYTICS}`);
  });

  it('falls back to the default cname when only a uuid is set', () => {
    expect(makeImg({ src: '', uuid: UUID })._getUrlBase()).toBe(`https://ucarecdn.com/${UUID}/${ANALYTICS}`);
  });

  /**
   * A `cdn-cname` carrying a path is reduced to its origin, and that is why
   * `_getUrlBase` runs the cname through `new URL(...).origin` rather than passing
   * it to `serializeFileUrl` raw.
   *
   * It looks redundant — `serializeFileUrl` trims a trailing slash on its own, and
   * it happily *keeps* a path prefix. But the CDN file-URL grammar has no room for
   * one: the uuid must be the first path segment, so `parseFileUrl` rejects
   * `https://cdn.example.com/prefix/<uuid>/`, and this method parses what it builds.
   * Pass the cname through and a prefixed cname renders no image at all instead of
   * rendering from the origin.
   */
  it('reduces a path-carrying cname to its origin', () => {
    const el = makeImg({ src: '', uuid: UUID, 'cdn-cname': 'https://cdn.example.com/prefix' });

    expect(el._getUrlBase()).toBe(`https://cdn.example.com/${UUID}/${ANALYTICS}`);
  });

  it('tolerates a trailing slash on the configured cname', () => {
    const el = makeImg({ src: '', uuid: UUID, 'cdn-cname': 'https://cdn.example.com/' });

    expect(el._getUrlBase()).toBe(`https://cdn.example.com/${UUID}/${ANALYTICS}`);
  });

  it('embeds an absolute src behind a proxy cname', () => {
    const el = makeImg({ src: 'https://example.com/a.png', 'proxy-cname': 'https://proxy.example.com' });

    expect(el._getUrlBase()).toBe(`https://proxy.example.com/${ANALYTICS}https://example.com/a.png`);
  });

  it('embeds an absolute src behind the pubkey delivery-proxy host', () => {
    const el = makeImg({ src: 'https://example.com/a.png', pubkey: 'mypub' });

    expect(el._getUrlBase()).toBe(`https://mypub.ucr.io/${ANALYTICS}https://example.com/a.png`);
  });

  it('prefers the cname+uuid branch over proxy-cname and pubkey', () => {
    const el = makeImg({
      src: 'https://example.com/a.png',
      'cdn-cname': 'https://cdn.example.com',
      uuid: UUID,
      'proxy-cname': 'https://proxy.example.com',
      pubkey: 'mypub',
    });

    expect(el._getUrlBase()).toBe(`https://cdn.example.com/${UUID}/${ANALYTICS}`);
  });

  // CHANGED (was: threw `TypeError: Invalid URL` out of the render path). Only
  // reachable by explicitly blanking the cname, since PROPS_MAP defaults it.
  it('degrades to no URL when the cname is explicitly emptied', () => {
    const el = makeImg({ src: '', uuid: UUID, 'cdn-cname': '' });

    expect(el._getUrlBase()).toBeUndefined();
  });

  it('degrades to no URL for a uuid that is not a real UUID', () => {
    // The library validates the UUID grammar; the old string concatenation would
    // have produced a URL that merely 404s.
    const el = makeImg({ src: '', uuid: 'not-a-uuid', 'cdn-cname': 'https://cdn.example.com' });

    expect(el._getUrlBase()).toBeUndefined();
  });

  it('degrades to no URL for an unparseable cdn-operations attribute', () => {
    const el = makeImg({ src: '', uuid: UUID, 'cdn-cname': 'https://cdn.example.com', 'cdn-operations': '-/-/' });

    expect(el._getUrlBase()).toBeUndefined();
  });

  // CHANGED (was: returned the group URL unchanged, so the browser got a non-image
  // URL and rendered a broken image with no diagnostic). `<uc-img>` parses only the
  // two kinds it can render — a stored file and a proxied source — which keeps the
  // group parsers out of this element's bundle, the tightest budget in the repo.
  it('degrades to no URL for a group src, which is not an image', () => {
    const el = makeImg({ src: `https://cdn.example.com/${UUID}~3/`, 'cdn-cname': 'https://cdn.example.com' });

    expect(el._getUrlBase()).toBeUndefined();
  });

  it('still appends operations to a delivery-proxy src on the cname', () => {
    // The reason `parseProxyUrl` is kept rather than parsing files only: a
    // hand-written proxy URL pointed at `<uc-img>` has to keep working.
    const el = makeImg({
      src: 'https://cdn.example.com/-/resize/100x/https://example.com/a.jpg',
      'cdn-cname': 'https://cdn.example.com',
    });

    expect(el._getUrlBase()).toBe(`https://cdn.example.com/-/resize/100x/${ANALYTICS}https://example.com/a.jpg`);
  });
});

describe('_getUrlBase — modifiers', () => {
  it('composes format, quality, resize, blur and passthrough cdn-operations in order, analytics last', () => {
    const el = makeImg({
      src: '',
      'cdn-cname': 'https://cdn.example.com',
      uuid: UUID,
      format: 'webp',
      quality: 'smart',
      'cdn-operations': '-/sharp/10/',
    });

    expect(el._getUrlBase('800x', '10')).toBe(
      `https://cdn.example.com/${UUID}/-/format/webp/-/quality/smart/-/resize/800x/-/blur/10/-/sharp/10/${ANALYTICS}`,
    );
  });

  it('omits unset config rather than emitting empty operations', () => {
    const el = makeImg({ src: '', 'cdn-cname': 'https://cdn.example.com', uuid: UUID });

    expect(el._getUrlBase()).toBe(`https://cdn.example.com/${UUID}/${ANALYTICS}`);
  });

  it(`clamps a breakpoint above MAX_WIDTH (${MAX_WIDTH})`, () => {
    const el = makeImg({ src: '', 'cdn-cname': 'https://c.example.com', uuid: UUID });

    expect(el._getUrlBase('4000x')).toBe(`https://c.example.com/${UUID}/-/resize/${MAX_WIDTH}x/${ANALYTICS}`);
  });

  it(`clamps a jpeg breakpoint at the higher MAX_WIDTH_JPG (${MAX_WIDTH_JPG})`, () => {
    const el = makeImg({ src: '', 'cdn-cname': 'https://c.example.com', uuid: UUID, format: 'jpeg' });

    expect(el._getUrlBase('6000x')).toBe(
      `https://c.example.com/${UUID}/-/format/jpeg/-/resize/${MAX_WIDTH_JPG}x/${ANALYTICS}`,
    );
  });

  it('drops a size with no unit', () => {
    const el = makeImg({ src: '', 'cdn-cname': 'https://c.example.com', uuid: UUID });

    expect(el._getUrlBase('800')).toBe(`https://c.example.com/${UUID}/${ANALYTICS}`);
  });

  // `parseObjectToString` filters `undefined` and `''` but not `null`, so a
  // caller passing an explicit null blur puts the literal in the URL.
  it('PRE-FIX: emits blur/null when blur is passed as null', () => {
    const el = makeImg({ src: '', 'cdn-cname': 'https://c.example.com', uuid: UUID });

    expect(el._getUrlBase('', null)).toBe(`https://c.example.com/${UUID}/-/blur/null/${ANALYTICS}`);
  });
});

describe('the consumers that compose _getUrlBase output', () => {
  const base = { src: '', 'cdn-cname': 'https://c.example.com', uuid: UUID };

  it('_getSrc delegates with no size or blur', () => {
    expect(makeImg(base)._getSrc()).toBe(`https://c.example.com/${UUID}/${ANALYTICS}`);
  });

  it('_srcUrlPreview asks for a 100px blurred preview', () => {
    expect(makeImg(base)._srcUrlPreview).toBe(`https://c.example.com/${UUID}/-/resize/100x/-/blur/100/${ANALYTICS}`);
  });

  it('_getSrcset emits one entry per breakpoint plus a hi-res entry, deduplicating overlaps', () => {
    // hi-res-support defaults to 1, ultra-res-support defaults to '' (off).
    // The entries live in a Set, so bp=200's hi-res entry (400x/400w) is
    // byte-identical to bp=400's 1x entry and collapses into it — three entries
    // for two breakpoints, not four.
    const el = makeImg({ ...base, breakpoints: '200, 400' });

    expect(el._getSrcset()).toBe(
      [
        `https://c.example.com/${UUID}/-/resize/200x/${ANALYTICS} 200w`,
        `https://c.example.com/${UUID}/-/resize/400x/${ANALYTICS} 400w`,
        `https://c.example.com/${UUID}/-/resize/800x/${ANALYTICS} 800w`,
      ].join(),
    );
  });

  it('_getSrcset adds an ultra-res entry when enabled', () => {
    const el = makeImg({ ...base, breakpoints: '200', 'ultra-res-support': 1 });

    expect(el._getSrcset()).toBe(
      [
        `https://c.example.com/${UUID}/-/resize/200x/${ANALYTICS} 200w`,
        `https://c.example.com/${UUID}/-/resize/400x/${ANALYTICS} 400w`,
        `https://c.example.com/${UUID}/-/resize/600x/${ANALYTICS} 600w`,
      ].join(),
    );
  });

  it('_getSrcset falls back to the element size when no breakpoints are configured', () => {
    // happy-dom reports zero layout, so `_getElSize` is stubbed the way a laid-out
    // element would answer; this pins the no-breakpoints composition (`1x`/`2x`
    // descriptors instead of width descriptors).
    const el = makeImg(base) as UrlBaseAccess & { _getElSize: (node: HTMLElement, k?: number) => string | null };
    el._getElSize = (_node, k = 1) => `${300 * k}x`;

    expect(el._getSrcset()).toBe(
      [
        `https://c.example.com/${UUID}/-/resize/300x/${ANALYTICS} 1x`,
        `https://c.example.com/${UUID}/-/resize/600x/${ANALYTICS} 2x`,
      ].join(),
    );
  });

  it('_getSrcset drops hi-res entries when hi-res-support is off', () => {
    const el = makeImg({ ...base, breakpoints: '200', 'hi-res-support': '' });

    expect(el._getSrcset()).toBe(`https://c.example.com/${UUID}/-/resize/200x/${ANALYTICS} 200w`);
  });
});

describe('_getUrlBase — secure delivery proxy', () => {
  it('wraps the built URL in the proxy template, URL-encoded', () => {
    const el = makeImg({
      src: '',
      'cdn-cname': 'https://cdn.example.com',
      uuid: UUID,
      'secure-delivery-proxy': 'https://proxy.test/?url={{previewUrl}}',
    });

    expect(el._getUrlBase()).toBe(
      `https://proxy.test/?url=${encodeURIComponent(`https://cdn.example.com/${UUID}/${ANALYTICS}`)}`,
    );
  });

  it('does not wrap a src that already sits on the cname', () => {
    // The matching-cname branch returns before `_proxyUrl` is reached.
    const el = makeImg({
      src: `https://cdn.example.com/${UUID}/`,
      'cdn-cname': 'https://cdn.example.com',
      'secure-delivery-proxy': 'https://proxy.test/?url={{previewUrl}}',
    });

    expect(el._getUrlBase()).toBe(`https://cdn.example.com/${UUID}/${ANALYTICS}`);
  });
});
