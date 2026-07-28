import { describe, expect, it } from 'vitest';
import {
  createCdnUrl,
  createCdnUrlModifiers,
  createOriginalUrl,
  extractCdnUrlModifiers,
  extractFilename,
  extractOperations,
  extractUuid,
  joinCdnOperations,
  normalizeCdnOperation,
  trimFilename,
} from './cdn-utils';

/**
 * Rewritten for the `@uploadcare/cdn-url` implementation. Two things changed
 * about the fixtures themselves, both forced by the library understanding CDN
 * URLs structurally rather than as strings:
 *
 * - `:uuid` placeholders are gone. The library validates the UUID grammar, so
 *   the tests use real UUIDs — which is also closer to what production passes.
 * - Inputs that are not complete CDN URLs (a bare origin, a path with no uuid)
 *   now throw `TypeError` instead of returning best-effort garbage, and are
 *   asserted as such.
 */
const UUID = 'c2499162-eb07-4b93-b31e-94a89a47e858';
const OTHER_UUID = 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const PROXY = 'https://domain.ucr.io:8080';
const SOURCE = 'https://domain.com/image.jpg?q=1#hash';

const falsyValues = ['', undefined, null, false, true, 0, 10];

describe('cdn-utils/normalizeCdnOperation', () => {
  it('should remove trailing and leading delimeters', () => {
    expect(normalizeCdnOperation('scale_crop/1x1/center')).toBe('scale_crop/1x1/center');
    expect(normalizeCdnOperation('/scale_crop/1x1/center/')).toBe('scale_crop/1x1/center');
    expect(normalizeCdnOperation('-/scale_crop/1x1/center/')).toBe('scale_crop/1x1/center');
  });

  it('should return empty string if falsy value is passed', () => {
    for (const val of falsyValues) {
      expect(normalizeCdnOperation(val)).toBe('');
    }
  });
});

describe('cdn-utils/joinCdnOperations', () => {
  it('should remove trailing and leading delimeters', () => {
    expect(joinCdnOperations('scale_crop/1x1/center', 'resize')).toBe('scale_crop/1x1/center/-/resize');
    expect(joinCdnOperations('/scale_crop/1x1/center/', '/resize/')).toBe('scale_crop/1x1/center/-/resize');
    expect(joinCdnOperations('-/scale_crop/1x1/center/', '-/resize/')).toBe('scale_crop/1x1/center/-/resize');
    expect(joinCdnOperations('-/scale_crop/1x1/center/', '-/resize/100x/')).toBe('scale_crop/1x1/center/-/resize/100x');
  });

  it('should return empty string if falsy values are passed', () => {
    expect(joinCdnOperations(...falsyValues)).toBe('');
    expect(joinCdnOperations('scale_crop/1x1/center', ...falsyValues, 'resize/100x')).toBe(
      'scale_crop/1x1/center/-/resize/100x',
    );
  });
});

describe('cdn-utils/createCdnUrlModifiers', () => {
  it('should make cdn operations string that could be concatendated with domain', () => {
    expect(createCdnUrlModifiers('scale_crop/1x1/center', 'resize')).toBe('-/scale_crop/1x1/center/-/resize/');
  });

  it('should add trailing/leading slash and leading delimeter', () => {
    expect(createCdnUrlModifiers('/scale_crop/1x1/center/', '/resize/')).toBe('-/scale_crop/1x1/center/-/resize/');
    expect(createCdnUrlModifiers('-/scale_crop/1x1/center/', '-/resize/')).toBe('-/scale_crop/1x1/center/-/resize/');
    expect(createCdnUrlModifiers('-/scale_crop/1x1/center/', '-/resize/100x/')).toBe(
      '-/scale_crop/1x1/center/-/resize/100x/',
    );
  });

  it('return empty string if nothing is passed', () => {
    expect(createCdnUrlModifiers(...falsyValues)).toBe('');
    expect(createCdnUrlModifiers('scale_crop/1x1/center', ...falsyValues, 'resize')).toBe(
      '-/scale_crop/1x1/center/-/resize/',
    );
  });

  it('should accept a fragment that already contains several operations', () => {
    expect(createCdnUrlModifiers('format/auto/-/progressive/yes', 'quality/smart')).toBe(
      '-/format/auto/-/progressive/yes/-/quality/smart/',
    );
  });

  it('should keep internal @-prefixed operations verbatim', () => {
    expect(createCdnUrlModifiers('@clib/uc-img/1.0/uc-img')).toBe('-/@clib/uc-img/1.0/uc-img/');
  });
});

describe('cdn-utils/createCdnUrl', () => {
  it('should concatenate baseCdnUrl with cdnModifiers', () => {
    expect(createCdnUrl(`https://ucarecdn.com/${UUID}/`, '-/scale_crop/1x1/center/')).toBe(
      `https://ucarecdn.com/${UUID}/-/scale_crop/1x1/center/`,
    );
  });

  it('should embed a remote source behind a proxy origin', () => {
    expect(createCdnUrl(`${PROXY}/`, '-/scale_crop/1x1/center/', SOURCE)).toBe(
      `${PROXY}/-/scale_crop/1x1/center/${SOURCE}`,
    );
  });

  it('should extract filename from baseCdnUrl and append it to the result', () => {
    expect(createCdnUrl(`https://ucarecdn.com/${UUID}/image.jpeg`, '-/scale_crop/1x1/center/')).toBe(
      `https://ucarecdn.com/${UUID}/-/scale_crop/1x1/center/image.jpeg`,
    );
    expect(createCdnUrl(`${PROXY}/${SOURCE}`, '-/scale_crop/1x1/center/')).toBe(
      `${PROXY}/-/scale_crop/1x1/center/${SOURCE}`,
    );
  });

  it('should override filename from baseCdnUrl with provided', () => {
    expect(createCdnUrl(`https://ucarecdn.com/${UUID}/image.jpeg`, '-/scale_crop/1x1/center/', 'override.jpeg')).toBe(
      `https://ucarecdn.com/${UUID}/-/scale_crop/1x1/center/override.jpeg`,
    );
    expect(createCdnUrl(`${PROXY}/${SOURCE}`, '-/scale_crop/1x1/center/', 'https://domain.com/override.jpg?q=2')).toBe(
      `${PROXY}/-/scale_crop/1x1/center/https://domain.com/override.jpg?q=2`,
    );
  });

  it('should keep cdn modifiers in the baseCdnUrl', () => {
    expect(createCdnUrl(`https://ucarecdn.com/${UUID}/-/resize/10x/`, '-/scale_crop/1x1/center/')).toBe(
      `https://ucarecdn.com/${UUID}/-/resize/10x/-/scale_crop/1x1/center/`,
    );
    expect(createCdnUrl(`${PROXY}/-/resize/10x/${SOURCE}`, '-/scale_crop/1x1/center/')).toBe(
      `${PROXY}/-/resize/10x/-/scale_crop/1x1/center/${SOURCE}`,
    );
  });

  it('should work without modifiers', () => {
    expect(createCdnUrl(`https://ucarecdn.com/${UUID}/`)).toBe(`https://ucarecdn.com/${UUID}/`);
  });

  it('should preserve a conversion path', () => {
    expect(createCdnUrl(`https://ucarecdn.com/${UUID}/video/-/resize/100x/`, '-/quality/best/')).toBe(
      `https://ucarecdn.com/${UUID}/video/-/resize/100x/-/quality/best/`,
    );
  });

  it('should throw for a base that is not a CDN URL', () => {
    // CHANGED: this used to yield `https://ucarecdn.com/-/scale_crop/1x1/center/`,
    // a URL addressing no file. Callers that face user input catch and degrade.
    expect(() => createCdnUrl('https://ucarecdn.com', '-/scale_crop/1x1/center/')).toThrow(TypeError);
  });
});

describe('cdn-utils/createOriginalUrl', () => {
  it('should concatenate cdnBase and uuid', () => {
    expect(createOriginalUrl('https://ucarecdn.com/', UUID)).toBe(`https://ucarecdn.com/${UUID}/`);
  });

  it('should trim any pathname from cdnBase', () => {
    expect(createOriginalUrl(`https://ucarecdn.com/${OTHER_UUID}/-/resize/10x/`, UUID)).toBe(
      `https://ucarecdn.com/${UUID}/`,
    );
  });

  it('should add trailing slash to the base url', () => {
    expect(createOriginalUrl('https://ucarecdn.com', UUID)).toBe(`https://ucarecdn.com/${UUID}/`);
  });

  it('should keep a custom cname and its port', () => {
    expect(createOriginalUrl('https://cdn.example.com:8443/whatever/', UUID)).toBe(
      `https://cdn.example.com:8443/${UUID}/`,
    );
  });
});

describe('cdn-utils/extractFilename', () => {
  it('should extract filename or file url', () => {
    expect(extractFilename(`https://ucarecdn.com/${UUID}/image.jpeg`)).toBe('image.jpeg');
    expect(extractFilename(`https://ucarecdn.com/${UUID}/-/resize/100x/image.jpeg`)).toBe('image.jpeg');
    expect(extractFilename(`${PROXY}/${SOURCE}`)).toBe(SOURCE);
    expect(extractFilename(`${PROXY}/-/resize/100x/${SOURCE}`)).toBe(SOURCE);
  });

  it('should return empty string if no filename found', () => {
    expect(extractFilename(`https://ucarecdn.com/${UUID}/`)).toBe('');
    expect(extractFilename(`https://ucarecdn.com/${UUID}/-/resize/100x/`)).toBe('');
  });

  it('should throw for a url that addresses no file', () => {
    expect(() => extractFilename('https://ucarecdn.com/')).toThrow(TypeError);
  });
});

describe('cdn-utils/trimFilename', () => {
  it('should trim filename or file url', () => {
    expect(trimFilename(`https://ucarecdn.com/${UUID}/image.jpeg`)).toBe(`https://ucarecdn.com/${UUID}/`);
    expect(trimFilename(`https://ucarecdn.com/${UUID}/-/resize/100x/image.jpeg`)).toBe(
      `https://ucarecdn.com/${UUID}/-/resize/100x/`,
    );
    expect(trimFilename(`${PROXY}/${SOURCE}`)).toBe(`${PROXY}/`);
    expect(trimFilename(`${PROXY}/-/resize/${SOURCE}`)).toBe(`${PROXY}/-/resize/`);
  });

  it('should return the same url if no filename found', () => {
    expect(trimFilename(`https://ucarecdn.com/${UUID}/`)).toBe(`https://ucarecdn.com/${UUID}/`);
    expect(trimFilename(`https://ucarecdn.com/${UUID}/-/resize/100x/`)).toBe(
      `https://ucarecdn.com/${UUID}/-/resize/100x/`,
    );
  });

  it('should drop a query string and hash along with the filename', () => {
    expect(trimFilename(`https://ucarecdn.com/${UUID}/image.jpeg?token=1#frag`)).toBe(`https://ucarecdn.com/${UUID}/`);
  });

  /**
   * The old substring-replace implementation corrupted any path whose trailing
   * segment recurred earlier — this is the `MIGRATION-PLAN.md` §0 bug, fixed by
   * construction now that the filename is separated structurally.
   */
  it('should not corrupt a path whose last segment repeats earlier', () => {
    expect(trimFilename(`https://ucarecdn.com/${UUID}/-/preview/preview`)).toBe(
      `https://ucarecdn.com/${UUID}/-/preview/`,
    );
  });
});

describe('cdn-utils/extractUuid', () => {
  it('should extract uuid from cdn url', () => {
    expect(extractUuid(`https://ucarecdn.com/${UUID}/image.jpeg`)).toBe(UUID);
    expect(extractUuid(`https://ucarecdn.com/${UUID}/-/resize/100x/image.jpeg`)).toBe(UUID);
    expect(extractUuid(`https://ucarecdn.com/${UUID}/`)).toBe(UUID);
  });

  it('should extract the group uuid for a group element', () => {
    expect(extractUuid(`https://ucarecdn.com/${UUID}~2/nth/0/`)).toBe(UUID);
  });

  it('should return empty string for a proxy url, which addresses no stored file', () => {
    expect(extractUuid(`${PROXY}/${SOURCE}`)).toBe('');
  });

  it('should throw for a url with no uuid', () => {
    expect(() => extractUuid('https://ucarecdn.com/not-a-uuid/image.jpeg')).toThrow(TypeError);
  });
});

describe('cdn-utils/extractOperations', () => {
  it('should extract operations from cdn url', () => {
    expect(extractOperations(`https://ucarecdn.com/${UUID}/image.jpeg`)).toEqual([]);
    expect(extractOperations(`https://ucarecdn.com/${UUID}/-/resize/100x/image.jpeg`)).toEqual(['resize/100x']);
    expect(extractOperations(`${PROXY}/-/resize/100x/${SOURCE}`)).toEqual(['resize/100x']);
  });

  it('should keep multi-parameter and @-prefixed operations intact', () => {
    expect(extractOperations(`https://ucarecdn.com/${UUID}/-/crop/640x480/10,20/-/@clib/x/1.0/`)).toEqual([
      'crop/640x480/10,20',
      '@clib/x/1.0',
    ]);
  });
});

describe('cdn-utils/extractCdnUrlModifiers', () => {
  it('should extract operations string from cdn url', () => {
    expect(extractCdnUrlModifiers(`https://ucarecdn.com/${UUID}/`)).toBe('');
    expect(extractCdnUrlModifiers(`https://ucarecdn.com/${UUID}/image.jpeg`)).toBe('');
    expect(extractCdnUrlModifiers(`https://ucarecdn.com/${UUID}/-/resize/100x/image.jpeg`)).toBe('-/resize/100x/');
    expect(extractCdnUrlModifiers(`${PROXY}/-/resize/100x/${SOURCE}`)).toBe('-/resize/100x/');
  });

  it('should round-trip through createCdnUrl', () => {
    const url = `https://ucarecdn.com/${UUID}/-/resize/100x/-/quality/smart/image.jpeg`;

    expect(createCdnUrl(trimFilename(url), '', extractFilename(url))).toBe(url);
  });
});
