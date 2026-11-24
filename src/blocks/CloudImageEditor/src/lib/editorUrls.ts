import { type CdnOperation, modifiers, serializeOperations, unsafeOperation } from '@uploadcare/cdn-url';
import type { Quality } from '@uploadcare/cdn-url/ops';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../../../env';
import { operationsFromModifiers, withOperations } from '../../../../utils/cdn/operations';
import type { Transformations } from '../types';
import { COMMON_OPERATIONS, transformationsToOperations } from './transformationUtils';

// The union in `OperationLiteral` cannot express an `@`-prefixed internal
// directive, so this is the one site that reaches for `unsafeOperation`.
// Parsed once via `operationsFromModifiers` so the rest of this file keeps
// working with `CdnOperation[]`, the shape `withOperations` needs.
const ANALYTICS_OPERATIONS = operationsFromModifiers(
  modifiers(unsafeOperation(`@clib/${PACKAGE_NAME}/${PACKAGE_VERSION}/uc-cloud-image-editor`)),
);
const JSON_OPERATIONS = operationsFromModifiers(modifiers('json'));
const PREVIEW_MARKER_OPERATIONS = operationsFromModifiers(modifiers('preview'));

/**
 * The URL whose `/json` reports the dimensions the cropper measures in: the bare
 * original. The editor's own transformations are excluded — the cropper accounts for
 * its own `rotate` itself, and the rest do not change geometry.
 */
export function editorImageInfoUrl(originalUrl: string): string {
  return withOperations(originalUrl, JSON_OPERATIONS);
}

/**
 * The URL the editor renders while the user is still editing: everything the
 * viewer, the fader and the filter thumbnails need, sized by the caller.
 *
 * Carries the same transformations as the applied URL, so what the user sees is
 * what Apply commits. Around them the two differ, and deliberately so. A preview is a
 * viewing concern: it leads with `COMMON_OPERATIONS` and trails with quality, the
 * caller's sizing and the editor's analytics marker, none of which belong in a
 * stored result. The applied URL carries only the `preview` marker.
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
    ...operationsFromModifiers(modifiers(`quality/${quality}`)),
    ...sizeOperations,
    ...ANALYTICS_OPERATIONS,
  ]);
}

/**
 * The URL the editor commits on Apply, and emits on the live change event.
 *
 * Carries only the modelled transformations: the editor cuts what it does not
 * model, as v1 did (see the NEXT-MAJOR note in `CloudImageEditorBlock`).
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
  const operations = [...transformationsToOperations(transformations), ...PREVIEW_MARKER_OPERATIONS];
  return {
    cdnUrl: withOperations(originalUrl, operations),
    cdnUrlModifiers: serializeOperations(operations),
  };
}
