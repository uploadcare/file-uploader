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
    const el = makeImg({ src: 'https://cdn.example.com/abc-uuid/', 'cdn-cname': 'https://cdn.example.com' });

    expect(el._getUrlBase()).toBe(`https://cdn.example.com/abc-uuid/${ANALYTICS}`);
  });

  it('builds from cname + uuid', () => {
    const el = makeImg({ src: '', 'cdn-cname': 'https://cdn.example.com', uuid: 'abc-uuid' });

    expect(el._getUrlBase()).toBe(`https://cdn.example.com/abc-uuid/${ANALYTICS}`);
  });

  it('falls back to the default cname when only a uuid is set', () => {
    expect(makeImg({ src: '', uuid: 'abc-uuid' })._getUrlBase()).toBe(`https://ucarecdn.com/abc-uuid/${ANALYTICS}`);
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
      uuid: 'abc-uuid',
      'proxy-cname': 'https://proxy.example.com',
      pubkey: 'mypub',
    });

    expect(el._getUrlBase()).toBe(`https://cdn.example.com/abc-uuid/${ANALYTICS}`);
  });

  // Only reachable by explicitly blanking the cname, since PROPS_MAP defaults it.
  it('PRE-FIX: throws when the cname is explicitly emptied and only a uuid is set', () => {
    const el = makeImg({ src: '', uuid: 'abc-uuid', 'cdn-cname': '' });

    expect(() => el._getUrlBase()).toThrow(TypeError);
  });
});

describe('_getUrlBase — modifiers', () => {
  it('composes format, quality, resize, blur and passthrough cdn-operations in order, analytics last', () => {
    const el = makeImg({
      src: '',
      'cdn-cname': 'https://cdn.example.com',
      uuid: 'abc-uuid',
      format: 'webp',
      quality: 'smart',
      'cdn-operations': '-/sharp/10/',
    });

    expect(el._getUrlBase('800x', '10')).toBe(
      `https://cdn.example.com/abc-uuid/-/format/webp/-/quality/smart/-/resize/800x/-/blur/10/-/sharp/10/${ANALYTICS}`,
    );
  });

  it('omits unset config rather than emitting empty operations', () => {
    const el = makeImg({ src: '', 'cdn-cname': 'https://cdn.example.com', uuid: 'abc-uuid' });

    expect(el._getUrlBase()).toBe(`https://cdn.example.com/abc-uuid/${ANALYTICS}`);
  });

  it(`clamps a breakpoint above MAX_WIDTH (${MAX_WIDTH})`, () => {
    const el = makeImg({ src: '', 'cdn-cname': 'https://c.example.com', uuid: 'u' });

    expect(el._getUrlBase('4000x')).toBe(`https://c.example.com/u/-/resize/${MAX_WIDTH}x/${ANALYTICS}`);
  });

  it(`clamps a jpeg breakpoint at the higher MAX_WIDTH_JPG (${MAX_WIDTH_JPG})`, () => {
    const el = makeImg({ src: '', 'cdn-cname': 'https://c.example.com', uuid: 'u', format: 'jpeg' });

    expect(el._getUrlBase('6000x')).toBe(
      `https://c.example.com/u/-/format/jpeg/-/resize/${MAX_WIDTH_JPG}x/${ANALYTICS}`,
    );
  });

  it('drops a size with no unit', () => {
    const el = makeImg({ src: '', 'cdn-cname': 'https://c.example.com', uuid: 'u' });

    expect(el._getUrlBase('800')).toBe(`https://c.example.com/u/${ANALYTICS}`);
  });

  // `parseObjectToString` filters `undefined` and `''` but not `null`, so a
  // caller passing an explicit null blur puts the literal in the URL.
  it('PRE-FIX: emits blur/null when blur is passed as null', () => {
    const el = makeImg({ src: '', 'cdn-cname': 'https://c.example.com', uuid: 'u' });

    expect(el._getUrlBase('', null)).toBe(`https://c.example.com/u/-/blur/null/${ANALYTICS}`);
  });
});

describe('the consumers that compose _getUrlBase output', () => {
  const base = { src: '', 'cdn-cname': 'https://c.example.com', uuid: 'u' };

  it('_getSrc delegates with no size or blur', () => {
    expect(makeImg(base)._getSrc()).toBe(`https://c.example.com/u/${ANALYTICS}`);
  });

  it('_srcUrlPreview asks for a 100px blurred preview', () => {
    expect(makeImg(base)._srcUrlPreview).toBe(`https://c.example.com/u/-/resize/100x/-/blur/100/${ANALYTICS}`);
  });

  it('_getSrcset emits one entry per breakpoint plus a hi-res entry, deduplicating overlaps', () => {
    // hi-res-support defaults to 1, ultra-res-support defaults to '' (off).
    // The entries live in a Set, so bp=200's hi-res entry (400x/400w) is
    // byte-identical to bp=400's 1x entry and collapses into it — three entries
    // for two breakpoints, not four.
    const el = makeImg({ ...base, breakpoints: '200, 400' });

    expect(el._getSrcset()).toBe(
      [
        `https://c.example.com/u/-/resize/200x/${ANALYTICS} 200w`,
        `https://c.example.com/u/-/resize/400x/${ANALYTICS} 400w`,
        `https://c.example.com/u/-/resize/800x/${ANALYTICS} 800w`,
      ].join(),
    );
  });

  it('_getSrcset adds an ultra-res entry when enabled', () => {
    const el = makeImg({ ...base, breakpoints: '200', 'ultra-res-support': 1 });

    expect(el._getSrcset()).toBe(
      [
        `https://c.example.com/u/-/resize/200x/${ANALYTICS} 200w`,
        `https://c.example.com/u/-/resize/400x/${ANALYTICS} 400w`,
        `https://c.example.com/u/-/resize/600x/${ANALYTICS} 600w`,
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
        `https://c.example.com/u/-/resize/300x/${ANALYTICS} 1x`,
        `https://c.example.com/u/-/resize/600x/${ANALYTICS} 2x`,
      ].join(),
    );
  });

  it('_getSrcset drops hi-res entries when hi-res-support is off', () => {
    const el = makeImg({ ...base, breakpoints: '200', 'hi-res-support': '' });

    expect(el._getSrcset()).toBe(`https://c.example.com/u/-/resize/200x/${ANALYTICS} 200w`);
  });
});

describe('_getUrlBase — secure delivery proxy', () => {
  it('wraps the built URL in the proxy template, URL-encoded', () => {
    const el = makeImg({
      src: '',
      'cdn-cname': 'https://cdn.example.com',
      uuid: 'abc-uuid',
      'secure-delivery-proxy': 'https://proxy.test/?url={{previewUrl}}',
    });

    expect(el._getUrlBase()).toBe(
      `https://proxy.test/?url=${encodeURIComponent(`https://cdn.example.com/abc-uuid/${ANALYTICS}`)}`,
    );
  });

  it('does not wrap a src that already sits on the cname', () => {
    // The matching-cname branch returns before `_proxyUrl` is reached.
    const el = makeImg({
      src: 'https://cdn.example.com/abc-uuid/',
      'cdn-cname': 'https://cdn.example.com',
      'secure-delivery-proxy': 'https://proxy.test/?url={{previewUrl}}',
    });

    expect(el._getUrlBase()).toBe(`https://cdn.example.com/abc-uuid/${ANALYTICS}`);
  });
});
