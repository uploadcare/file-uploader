import type { Quality } from '@uploadcare/cdn-url/ops';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../../../env';
import {
  type CdnOperation,
  modifiers,
  operationsFromModifiers,
  serializeOperations,
  unsafeOperation,
  withOperations,
} from '../../../../utils/cdn';
import type { Transformations } from '../types';
import { COMMON_OPERATIONS, mergeTransformationsIntoOperations, preservedOperations } from './transformationUtils';

// The union in `OperationLiteral` cannot express an `@`-prefixed internal
// directive, so this is the one site that reaches for `unsafeOperation`.
// Parsed once via `operationsFromModifiers` so the rest of this file keeps
// working with `CdnOperation[]`, the shape the merge and `withOperations` need.
const ANALYTICS_OPERATION_NAME = '@clib';
const ANALYTICS_OPERATIONS = operationsFromModifiers(
  modifiers(unsafeOperation(`@clib/${PACKAGE_NAME}/${PACKAGE_VERSION}/uc-cloud-image-editor`)),
);
const JSON_OPERATIONS = operationsFromModifiers(modifiers('json'));
const PREVIEW_MARKER_OPERATIONS = operationsFromModifiers(modifiers('preview'));

/**
 * The URL whose `/json` reports the dimensions the cropper measures in.
 *
 * Not the bare original: the editor's `crop` is emitted after everything the source
 * preserved, so its coordinates are interpreted against the image as those operations
 * leave it. Measure anywhere else and a preserved `resize` desynchronises the crop
 * overlay from the box the user drags.
 *
 * The editor's own modelled transformations are excluded — the cropper accounts for
 * its own `rotate` itself, and the rest do not change geometry.
 */
export function editorImageInfoUrl(originalUrl: string, sourceOperations: readonly CdnOperation[]): string {
  return withOperations(originalUrl, [...preservedOperations(sourceOperations), ...JSON_OPERATIONS]);
}

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
  const source = sourceOperations.filter((operation) => operation.name !== ANALYTICS_OPERATION_NAME);
  return withOperations(originalUrl, [
    ...COMMON_OPERATIONS,
    ...mergeTransformationsIntoOperations(source, transformations),
    ...operationsFromModifiers(modifiers(`quality/${quality}`)),
    ...sizeOperations,
    ...ANALYTICS_OPERATIONS,
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
  const operations = [
    ...mergeTransformationsIntoOperations(sourceOperations, transformations),
    ...PREVIEW_MARKER_OPERATIONS,
  ];
  return {
    cdnUrl: withOperations(originalUrl, operations),
    cdnUrlModifiers: serializeOperations(operations),
  };
}
