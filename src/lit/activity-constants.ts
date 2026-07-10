import type { ActivityParams as CloudImageEditorActivityParams } from '../blocks/CloudImageEditorActivity/CloudImageEditorActivity';
import type { ActivityParams as ExternalSourceActivityParams } from '../blocks/ExternalSource/ExternalSource';

/**
 * Consumer-augmentable map of custom activity ids → `{ params }`. Declared here
 * (a dependency-free leaf) rather than in `LitActivityBlock` so the activity-id
 * types below don't form an import cycle through `LitBlock` — which made the
 * `keyof CustomActivities` term resolve inconsistently (wide in some positions,
 * narrow in others). Re-exported from the package root (via `src/types`), so
 * consumer `declare module` augmentations of the published entry still merge
 * in the flattened dist types; in-repo augmentations target this file directly
 * (see `unsplashPlugin`).
 */
// biome-ignore lint/suspicious/noEmptyInterface: consumer-augmented interface
export interface CustomActivities {}

export const ACTIVITY_TYPES = Object.freeze({
  START_FROM: 'start-from',
  CAMERA: 'camera',
  UPLOAD_LIST: 'upload-list',
  URL: 'url',
  CLOUD_IMG_EDIT: 'cloud-image-edit',
  EXTERNAL: 'external',
} as const);

export type RegisteredActivityType = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES] | keyof CustomActivities;
export type ActivityType = RegisteredActivityType | null;

/**
 * Strict, v2-native activity id: the built-in literals plus consumer-augmented
 * `CustomActivities` keys — and nothing else. The `RouterController` uses it as
 * its internal id type. Aliased to {@link RegisteredActivityType} (same
 * membership, exposed under the router's own name) so the two can't drift.
 */
export type ActivityId = RegisteredActivityType;

/** Maps each activity id to the params shape it accepts (built-in + augmented). */
export type ActivityParamsMap = {
  'cloud-image-edit': CloudImageEditorActivityParams;
  external: ExternalSourceActivityParams;
} & {
  [Key in keyof CustomActivities]: CustomActivities[Key]['params'];
};
