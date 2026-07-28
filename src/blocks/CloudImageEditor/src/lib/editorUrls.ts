import { PACKAGE_NAME, PACKAGE_VERSION } from '../../../../env';
import { operationsFromModifiers, withOperations } from '../../../../utils/cdn';
import type { Transformations } from '../types';
import { COMMON_OPERATIONS, transformationsToOperations } from './transformationUtils';

const ANALYTICS = `@clib/${PACKAGE_NAME}/${PACKAGE_VERSION}/uc-cloud-image-editor/`;

/**
 * The URL the editor renders while the user is still editing: everything the
 * viewer and the filter thumbnails need, sized by the caller.
 *
 * Note this does NOT carry passthrough operations, matching the behaviour of the
 * previous implementation — a known gap recorded in the design doc.
 */
export function editorPreviewUrl({
  originalUrl,
  transformations,
  sizeOperation,
  quality,
}: {
  originalUrl: string;
  transformations: Transformations;
  sizeOperation: string;
  quality: string;
}): string {
  return withOperations(
    originalUrl,
    operationsFromModifiers(
      COMMON_OPERATIONS,
      transformationsToOperations(transformations),
      `quality/${quality}`,
      sizeOperation,
      ANALYTICS,
    ),
  );
}

/**
 * The URL the editor commits on Apply, and emits on the live change event.
 *
 * `passthrough` holds operations the editor cannot model, appended after the
 * recomputed ones — presence is preserved, placement is not (order matters to the
 * CDN for a few pairs, e.g. `stretch` applies to a following resize).
 */
export function editorAppliedUrl({
  originalUrl,
  transformations,
  passthrough,
}: {
  originalUrl: string;
  transformations: Transformations;
  passthrough: readonly string[];
}): string {
  return withOperations(
    originalUrl,
    operationsFromModifiers(transformationsToOperations(transformations), ...passthrough, 'preview'),
  );
}
