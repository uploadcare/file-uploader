import { type CdnOperation, modifiers } from '@uploadcare/cdn-url';
import { operationsFromModifiers } from '../../../utils/cdn/operations';
import { editorPreviewUrl } from './lib/editorUrls';
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
