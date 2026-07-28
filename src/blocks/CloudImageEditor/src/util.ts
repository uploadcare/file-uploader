import { resize, stretch } from '@uploadcare/cdn-url/ops';
import { editorPreviewUrl } from './lib/editorUrls';
import type { Transformations } from './types';

export function viewerImageSrc(originalUrl: string, width: number, transformations: Transformations): string {
  const MAX_CDN_DIMENSION = 3000;
  const dpr = window.devicePixelRatio;
  const size = Math.min(Math.ceil(width * dpr), MAX_CDN_DIMENSION);

  return editorPreviewUrl({
    originalUrl,
    transformations,
    quality: dpr >= 2 ? 'lightest' : 'normal',
    sizeOperations: [stretch('off'), resize({ width: size })],
  });
}
