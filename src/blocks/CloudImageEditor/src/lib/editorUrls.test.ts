import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../../../env';
import { type CdnOperation, modifiers, type OperationLiteral, operationsFromModifiers } from '../../../../utils/cdn';
import type { Transformations } from '../types';
import { editorAppliedUrl, editorImageInfoUrl, editorPreviewUrl } from './editorUrls';

const UUID = 'c2499162-eb07-4b93-b31e-94a89a47e858';
const ORIGINAL = `https://ucarecdn.com/${UUID}/`;
const ANALYTICS = `@clib/${PACKAGE_NAME}/${PACKAGE_VERSION}/uc-cloud-image-editor/`;

/** Size operations as typed literals, matching how production authors them. */
const ops = (...fragments: OperationLiteral[]): CdnOperation[] => operationsFromModifiers(modifiers(...fragments));

describe('editorPreviewUrl', () => {
  it('composes common operations, transformations, quality, sizing and analytics in that order', () => {
    const transformations: Transformations = { brightness: 50 };

    expect(
      editorPreviewUrl({
        originalUrl: ORIGINAL,
        transformations,
        sourceOperations: [],
        sizeOperations: ops('stretch/off', 'resize/800x'),
        quality: 'normal',
      }),
    ).toBe(
      `https://ucarecdn.com/${UUID}/-/format/auto/-/progressive/yes/-/brightness/50/-/quality/normal/-/stretch/off/-/resize/800x/-/${ANALYTICS}`,
    );
  });

  it('omits transformations that are at their default', () => {
    expect(
      editorPreviewUrl({
        originalUrl: ORIGINAL,
        transformations: { brightness: 0 },
        sourceOperations: [],
        sizeOperations: ops('resize/100x'),
        quality: 'lightest',
      }),
    ).toBe(
      `https://ucarecdn.com/${UUID}/-/format/auto/-/progressive/yes/-/quality/lightest/-/resize/100x/-/${ANALYTICS}`,
    );
  });

  it('renders the operations the editor cannot model, so a watermark is visible while editing', () => {
    const url = editorPreviewUrl({
      originalUrl: `https://ucarecdn.com/${UUID}/`,
      transformations: { brightness: 50 },
      sourceOperations: operationsFromModifiers('overlay/wm-uuid'),
      sizeOperations: ops('stretch/off', 'resize/800x'),
      quality: 'normal',
    });

    expect(url).toBe(
      `https://ucarecdn.com/${UUID}/-/format/auto/-/progressive/yes/-/overlay/wm-uuid/-/brightness/50/` +
        `-/quality/normal/-/stretch/off/-/resize/800x/-/@clib/${PACKAGE_NAME}/${PACKAGE_VERSION}/uc-cloud-image-editor/`,
    );
  });

  it('drops the source analytics marker so the preview carries only the editor own', () => {
    const url = editorPreviewUrl({
      originalUrl: `https://ucarecdn.com/${UUID}/`,
      transformations: {},
      sourceOperations: operationsFromModifiers(`@clib/uc-img/1.0/uc-img`, 'overlay/wm-uuid'),
      sizeOperations: [],
      quality: 'normal',
    });

    expect(url).not.toContain('uc-img');
    expect(url).toContain('overlay/wm-uuid');
  });

  it('agrees with the applied url on every operation except their trailing ones', () => {
    const args = {
      originalUrl: `https://ucarecdn.com/${UUID}/`,
      transformations: { brightness: 50, crop: { dimensions: [640, 480], coords: [10, 20] } } as Transformations,
      sourceOperations: operationsFromModifiers('overlay/wm-uuid', 'blur/20'),
    };
    const preview = editorPreviewUrl({ ...args, sizeOperations: [], quality: 'normal' });
    const { cdnUrl: applied } = editorAppliedUrl(args);

    const shared = '-/overlay/wm-uuid/-/blur/20/-/brightness/50/-/crop/640x480/10,20/';
    expect(preview).toContain(shared);
    expect(applied).toContain(shared);
  });
});

describe('editorAppliedUrl', () => {
  it('appends the preview marker after the transformations for a source with no operations', () => {
    expect(editorAppliedUrl({ originalUrl: ORIGINAL, transformations: { rotate: 90 }, sourceOperations: [] })).toEqual({
      cdnUrl: `https://ucarecdn.com/${UUID}/-/rotate/90/-/preview/`,
      cdnUrlModifiers: '-/rotate/90/-/preview/',
    });
  });

  /**
   * CHANGED (was: "re-emits carried operations between the transformations and
   * the preview marker" — every unmodelled operation appended after the
   * recomputed transformations, in source order, regardless of where they sat
   * in the source). The mechanism now edits the source list in place: an
   * unmodelled operation keeps the position the source URL gave it instead of
   * always moving to the end. Here `blur`/`overlay` sat *before* `rotate` in
   * the source, and now stay there.
   */
  it('keeps unmodelled operations in their original position, not appended after the transformations', () => {
    expect(
      editorAppliedUrl({
        originalUrl: ORIGINAL,
        transformations: { rotate: 90 },
        sourceOperations: operationsFromModifiers('blur/20', 'overlay/wm-uuid'),
      }),
    ).toEqual({
      cdnUrl: `https://ucarecdn.com/${UUID}/-/blur/20/-/overlay/wm-uuid/-/rotate/90/-/preview/`,
      cdnUrlModifiers: '-/blur/20/-/overlay/wm-uuid/-/rotate/90/-/preview/',
    });
  });

  it('produces just the preview marker when nothing is set', () => {
    expect(editorAppliedUrl({ originalUrl: ORIGINAL, transformations: {}, sourceOperations: [] })).toEqual({
      cdnUrl: `https://ucarecdn.com/${UUID}/-/preview/`,
      cdnUrlModifiers: '-/preview/',
    });
  });

  it("keeps an interleaved modelled operation's position, matching the brief's own example", () => {
    // `-/blur/20/-/brightness/50/` now applies as
    // `-/blur/20/-/brightness/50/-/preview/`, not the old
    // `-/brightness/50/-/blur/20/-/preview/`.
    expect(
      editorAppliedUrl({
        originalUrl: ORIGINAL,
        transformations: { brightness: 50 },
        sourceOperations: operationsFromModifiers('blur/20', 'brightness/50'),
      }),
    ).toEqual({
      cdnUrl: `https://ucarecdn.com/${UUID}/-/blur/20/-/brightness/50/-/preview/`,
      cdnUrlModifiers: '-/blur/20/-/brightness/50/-/preview/',
    });
  });
});

/**
 * These pin the coordinate space the cropper measures in. The editor's `crop` is
 * emitted after everything the source preserved, so the dimensions must be read
 * after those same operations — measuring the bare original would desynchronise the
 * crop overlay from the box the user drags whenever a source carries a `resize`.
 */
describe('editorImageInfoUrl', () => {
  it('measures the bare original when the source preserved nothing', () => {
    // The common case, and the one every pre-existing test covers: unchanged.
    expect(editorImageInfoUrl(ORIGINAL, [])).toBe(`https://ucarecdn.com/${UUID}/-/json/`);
  });

  it('measures after a preserved geometry operation, which is the whole point', () => {
    expect(editorImageInfoUrl(ORIGINAL, operationsFromModifiers('resize/300x'))).toBe(
      `https://ucarecdn.com/${UUID}/-/resize/300x/-/json/`,
    );
  });

  it('keeps every preserved operation, in source order', () => {
    expect(editorImageInfoUrl(ORIGINAL, operationsFromModifiers('overlay/wm-uuid', 'resize/300x', 'blur/20'))).toBe(
      `https://ucarecdn.com/${UUID}/-/overlay/wm-uuid/-/resize/300x/-/blur/20/-/json/`,
    );
  });

  it('excludes the modelled transformations', () => {
    // `crop` is what is being measured *for*, and the cropper accounts for its own
    // `rotate`; including either would make the measurement circular.
    expect(
      editorImageInfoUrl(ORIGINAL, operationsFromModifiers('crop/100x100/0,0', 'rotate/90', 'brightness/50')),
    ).toBe(`https://ucarecdn.com/${UUID}/-/json/`);
  });

  it("excludes the editor's own preview marker", () => {
    expect(editorImageInfoUrl(ORIGINAL, operationsFromModifiers('preview', 'blur/20'))).toBe(
      `https://ucarecdn.com/${UUID}/-/blur/20/-/json/`,
    );
  });
});
