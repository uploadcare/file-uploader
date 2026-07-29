import { resize, stretch } from '@uploadcare/cdn-url/ops';
import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../../../env';
import { operationsFromModifiers } from '../../../../utils/cdn';
import type { Transformations } from '../types';
import { editorAppliedUrl, editorPreviewUrl } from './editorUrls';

const UUID = 'c2499162-eb07-4b93-b31e-94a89a47e858';
const ORIGINAL = `https://ucarecdn.com/${UUID}/`;
const ANALYTICS = `@clib/${PACKAGE_NAME}/${PACKAGE_VERSION}/uc-cloud-image-editor/`;

describe('editorPreviewUrl', () => {
  it('composes common operations, transformations, quality, sizing and analytics in that order', () => {
    const transformations: Transformations = { brightness: 50 };

    expect(
      editorPreviewUrl({
        originalUrl: ORIGINAL,
        transformations,
        sourceOperations: [],
        sizeOperations: [stretch('off'), resize({ width: 800 })],
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
        sizeOperations: [resize({ width: 100 })],
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
      sizeOperations: [stretch('off'), resize({ width: 800 })],
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
