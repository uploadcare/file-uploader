import { preview, type Quality, quality as qualityOp, rawOp } from '@uploadcare/cdn-url/ops';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../../../env';
import { type CdnOperation, serializeOperations, withOperations } from '../../../../utils/cdn';
import type { Transformations } from '../types';
import { COMMON_OPERATIONS, transformationsToOperations } from './transformationUtils';

const ANALYTICS = rawOp('@clib', PACKAGE_NAME, PACKAGE_VERSION, 'uc-cloud-image-editor');

/**
 * The URL the editor renders while the user is still editing: everything the
 * viewer and the filter thumbnails need, sized by the caller.
 */
export function editorPreviewUrl({
  originalUrl,
  transformations,
  sizeOperations,
  quality,
}: {
  originalUrl: string;
  transformations: Transformations;
  sizeOperations: readonly CdnOperation[];
  quality: Quality;
}): string {
  return withOperations(originalUrl, [
    ...COMMON_OPERATIONS,
    ...transformationsToOperations(transformations),
    qualityOp(quality),
    ...sizeOperations,
    ANALYTICS,
  ]);
}

/**
 * The URL the editor commits on Apply, and emits on the live change event.
 *
 * Returns `cdnUrlModifiers` alongside `cdnUrl` — both are public fields on the
 * documented `apply`/`change` events (`ApplyResult`), so the operation list is
 * composed once here rather than separately at each call site, where it could
 * silently diverge from the URL.
 */
export function editorAppliedUrl({
  originalUrl,
  transformations,
}: {
  originalUrl: string;
  transformations: Transformations;
}): { cdnUrl: string; cdnUrlModifiers: string } {
  const operations = [...transformationsToOperations(transformations), preview()];
  return {
    cdnUrl: withOperations(originalUrl, operations),
    cdnUrlModifiers: serializeOperations(operations),
  };
}
