import { preview, type Quality, quality as qualityOp, rawOp } from '@uploadcare/cdn-url/ops';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../../../env';
import { type CdnOperation, serializeOperations, withOperations } from '../../../../utils/cdn';
import type { Transformations } from '../types';
import { COMMON_OPERATIONS, mergeTransformationsIntoOperations } from './transformationUtils';

const ANALYTICS = rawOp('@clib', PACKAGE_NAME, PACKAGE_VERSION, 'uc-cloud-image-editor');

/**
 * The URL the editor renders while the user is still editing: everything the
 * viewer, the fader and the filter thumbnails need, sized by the caller.
 *
 * Composed from the same merge as the applied URL, so what the user sees is what
 * Apply commits — a watermarked source previews watermarked. The merged section is
 * identical in both; around it they differ, and deliberately so. A preview is a
 * viewing concern: it leads with `COMMON_OPERATIONS` and trails with quality, the
 * caller's sizing and the editor's analytics marker, none of which belong in a
 * stored result. The applied URL carries only the `preview` marker.
 */
export function editorPreviewUrl({
  originalUrl,
  transformations,
  sourceOperations,
  sizeOperations,
  quality,
}: {
  originalUrl: string;
  transformations: Transformations;
  sourceOperations: readonly CdnOperation[];
  sizeOperations: readonly CdnOperation[];
  quality: Quality;
}): string {
  // The source's own analytics marker identifies whatever produced that URL; on a
  // preview the editor's marker is the truthful one, so drop the source's rather
  // than emitting two.
  const source = sourceOperations.filter((operation) => operation.name !== ANALYTICS.name);
  return withOperations(originalUrl, [
    ...COMMON_OPERATIONS,
    ...mergeTransformationsIntoOperations(source, transformations),
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
  const operations = [...mergeTransformationsIntoOperations(sourceOperations, transformations), preview()];
  return {
    cdnUrl: withOperations(originalUrl, operations),
    cdnUrlModifiers: serializeOperations(operations),
  };
}
