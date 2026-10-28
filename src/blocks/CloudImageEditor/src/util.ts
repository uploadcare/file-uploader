import { type CdnOperation, modifiers } from '@uploadcare/cdn-url';
import { operationsFromModifiers } from '../../../utils/cdn/operations';
import { editorPreviewUrl } from './lib/editorUrls';
import { operationsBeforeGeometry } from './lib/transformationUtils';
import type { Transformations } from './types';

export function viewerImageSrc(
  originalUrl: string,
  width: number,
  transformations: Transformations,
  sourceOperations: readonly CdnOperation[],
): string {
  const MAX_CDN_DIMENSION = 3000;
  const dpr = window.devicePixelRatio;
  const size = Math.min(Math.ceil(width * dpr), MAX_CDN_DIMENSION);

  return editorPreviewUrl({
    originalUrl,
    transformations,
    sourceOperations,
    quality: dpr >= 2 ? 'lightest' : 'normal',
    sizeOperations: operationsFromModifiers(modifiers('stretch/off', `resize/${size}x`)),
  });
}

/**
 * The image the cropper draws on: the space a `crop` addresses. Without the editor's geometry, which the cropper
 * draws itself, and without what the source applied after its geometry (`-/crop/…/-/resize/100x/`), which acts on the
 * crop's result — shown here, a 100px-wide resize would be what the user crops.
 */
export function cropperImageSrc(
  originalUrl: string,
  width: number,
  transformations: Transformations,
  sourceOperations: readonly CdnOperation[],
): string {
  return viewerImageSrc(
    originalUrl,
    width,
    { ...transformations, crop: undefined, rotate: undefined, flip: undefined, mirror: undefined },
    operationsBeforeGeometry(sourceOperations),
  );
}
