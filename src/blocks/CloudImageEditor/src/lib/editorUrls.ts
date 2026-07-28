import { type Quality, quality as qualityOp, rawOp } from '@uploadcare/cdn-url/ops';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../../../env';
import { type CdnOperation, serializeOperations, withOperations } from '../../../../utils/cdn';
import type { Transformations } from '../types';
import {
  COMMON_OPERATIONS,
  mergeTransformationsIntoOperations,
  transformationsToOperations,
} from './transformationUtils';

const ANALYTICS = rawOp('@clib', PACKAGE_NAME, PACKAGE_VERSION, 'uc-cloud-image-editor');

/**
 * The URL the editor renders while the user is still editing: everything the
 * viewer and the filter thumbnails need, sized by the caller.
 *
 * Built from the transformations alone, so unlike the applied URL it does **not**
 * carry the operations the editor cannot model: a watermarked source previews
 * without its watermark, then keeps it on Apply. A known asymmetry, recorded in the
 * design doc — closing it would change every filter-thumbnail fetch, so it is its
 * own change.
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
 * `sourceOperations` is the full operation list the source URL carried,
 * unfiltered. Rather than rebuilding the list from the modelled transformations
 * and appending whatever the editor cannot model, `mergeTransformationsIntoOperations`
 * edits that list in place — an operation the editor does not model keeps its
 * original position, which matters to the CDN for a few pairs (e.g. `stretch`
 * applies to a following resize).
 *
 * Returns `cdnUrlModifiers` alongside `cdnUrl` — both are public fields on the
 * documented `apply`/`change` events (`ApplyResult`), so the operation list is
 * composed once here rather than separately at each call site, where it could
 * silently diverge from the URL.
 */
export function editorAppliedUrl({
  originalUrl,
  transformations,
  sourceOperations,
}: {
  originalUrl: string;
  transformations: Transformations;
  sourceOperations: readonly CdnOperation[];
}): { cdnUrl: string; cdnUrlModifiers: string } {
  const operations = mergeTransformationsIntoOperations(sourceOperations, transformations);
  return {
    cdnUrl: withOperations(originalUrl, operations),
    cdnUrlModifiers: serializeOperations(operations),
  };
}
