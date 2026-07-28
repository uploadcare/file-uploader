import { parseFileUrl } from '@uploadcare/cdn-url';
import { describe, expect, it } from 'vitest';
import { modifiersFromOperations, operationsFromModifiers, withOperations } from './operations';

const UUID = 'c2499162-eb07-4b93-b31e-94a89a47e858';
const PROXY = 'https://domain.ucr.io:8080';
const SOURCE = 'https://domain.com/image.jpg?q=1#hash';

describe('operationsFromModifiers', () => {
  it('parses a bare fragment', () => {
    expect(operationsFromModifiers('resize/100x')).toEqual([{ name: 'resize', params: ['100x'] }]);
  });

  it('tolerates leading `-/` and a trailing slash', () => {
    expect(operationsFromModifiers('-/resize/100x/')).toEqual([{ name: 'resize', params: ['100x'] }]);
    expect(operationsFromModifiers('/resize/100x')).toEqual([{ name: 'resize', params: ['100x'] }]);
  });

  it('accepts a fragment that already chains several operations', () => {
    expect(operationsFromModifiers('format/auto/-/progressive/yes')).toEqual([
      { name: 'format', params: ['auto'] },
      { name: 'progressive', params: ['yes'] },
    ]);
  });

  it('joins multiple fragments in order', () => {
    expect(operationsFromModifiers('resize/100x', 'quality/smart')).toEqual([
      { name: 'resize', params: ['100x'] },
      { name: 'quality', params: ['smart'] },
    ]);
  });

  it('drops non-string and empty fragments, so callers can pass config values straight through', () => {
    expect(operationsFromModifiers('', undefined, null, false, true, 0, 10, 'resize/100x')).toEqual([
      { name: 'resize', params: ['100x'] },
    ]);
  });

  it('returns nothing for no usable fragments', () => {
    expect(operationsFromModifiers(undefined, '')).toEqual([]);
  });

  it('keeps internal @-prefixed operations verbatim', () => {
    expect(operationsFromModifiers('@clib/uc-img/1.0/uc-img')).toEqual([
      { name: '@clib', params: ['uc-img', '1.0', 'uc-img'] },
    ]);
  });

  it('throws for a fragment that is not an operation chain', () => {
    expect(() => operationsFromModifiers('-/-/')).toThrow(TypeError);
  });
});

describe('modifiersFromOperations', () => {
  it('serialises to the `-/…/` wire form', () => {
    expect(modifiersFromOperations([{ name: 'resize', params: ['100x'] }])).toBe('-/resize/100x/');
  });

  it('returns an empty string for no operations', () => {
    expect(modifiersFromOperations([])).toBe('');
  });

  it('round-trips with operationsFromModifiers', () => {
    const modifiers = '-/crop/640x480/10,20/-/preview/';

    expect(modifiersFromOperations(operationsFromModifiers(modifiers))).toBe(modifiers);
  });
});

describe('withOperations', () => {
  it('appends after operations the url already carries', () => {
    expect(withOperations(`https://ucarecdn.com/${UUID}/-/resize/10x/`, [{ name: 'preview', params: [] }])).toBe(
      `https://ucarecdn.com/${UUID}/-/resize/10x/-/preview/`,
    );
  });

  it('keeps the filename', () => {
    expect(withOperations(`https://ucarecdn.com/${UUID}/photo.jpg`, [{ name: 'preview', params: [] }])).toBe(
      `https://ucarecdn.com/${UUID}/-/preview/photo.jpg`,
    );
  });

  it('keeps a conversion path', () => {
    expect(
      withOperations(`https://ucarecdn.com/${UUID}/video/-/resize/100x/`, [{ name: 'quality', params: ['best'] }]),
    ).toBe(`https://ucarecdn.com/${UUID}/video/-/resize/100x/-/quality/best/`);
  });

  it('throws for a proxy url, which is not a single-file url', () => {
    expect(() => withOperations(`${PROXY}/-/resize/10x/${SOURCE}`, [{ name: 'preview', params: [] }])).toThrow(
      TypeError,
    );
  });

  it('returns the url unchanged for no operations', () => {
    expect(withOperations(`https://ucarecdn.com/${UUID}/`, [])).toBe(`https://ucarecdn.com/${UUID}/`);
  });

  it('throws for a group root, which is not a single-file url', () => {
    expect(() => withOperations(`https://ucarecdn.com/${UUID}~2/`, [{ name: 'preview', params: [] }])).toThrow(
      TypeError,
    );
  });

  it('throws for a base that is not a CDN url', () => {
    expect(() => withOperations('https://ucarecdn.com/', [{ name: 'preview', params: [] }])).toThrow(TypeError);
  });
});

describe('parseFileUrl', () => {
  it('narrows a single-file url', () => {
    const parsed = parseFileUrl(`https://ucarecdn.com/${UUID}/-/resize/100x/photo.jpg`);

    expect(parsed.uuid).toBe(UUID);
    expect(parsed.filename).toBe('photo.jpg');
    expect(parsed.operations).toEqual([{ name: 'resize', params: ['100x'] }]);
  });

  it('accepts a conversion result, which is still a single file', () => {
    expect(parseFileUrl(`https://ucarecdn.com/${UUID}/video/-/quality/best/`).conversion).toBe('video');
  });

  it.each([
    ['a group root', `https://ucarecdn.com/${UUID}~2/`],
    ['a group element', `https://ucarecdn.com/${UUID}~2/nth/0/x.jpg`],
    ['a delivery-proxy url', `${PROXY}/${SOURCE}`],
  ])('rejects %s, which addresses no single stored file', (_label, url) => {
    expect(() => parseFileUrl(url)).toThrow(TypeError);
  });

  it('rejects something that is not a cdn url at all', () => {
    expect(() => parseFileUrl('https://ucarecdn.com/')).toThrow(TypeError);
  });
});
