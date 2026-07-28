import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../../../env';
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
        sizeOperation: 'stretch/off/-/resize/800x',
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
        sizeOperation: 'resize/100x',
        quality: 'lightest',
      }),
    ).toBe(
      `https://ucarecdn.com/${UUID}/-/format/auto/-/progressive/yes/-/quality/lightest/-/resize/100x/-/${ANALYTICS}`,
    );
  });
});

describe('editorAppliedUrl', () => {
  it('appends the preview marker after the transformations', () => {
    expect(editorAppliedUrl({ originalUrl: ORIGINAL, transformations: { rotate: 90 } })).toEqual({
      cdnUrl: `https://ucarecdn.com/${UUID}/-/rotate/90/-/preview/`,
      cdnUrlModifiers: '-/rotate/90/-/preview/',
    });
  });

  it('produces just the preview marker when nothing is set', () => {
    expect(editorAppliedUrl({ originalUrl: ORIGINAL, transformations: {} })).toEqual({
      cdnUrl: `https://ucarecdn.com/${UUID}/-/preview/`,
      cdnUrlModifiers: '-/preview/',
    });
  });
});
