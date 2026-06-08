export type ActivityId =
  | 'start-from'
  | 'upload-list'
  | 'camera'
  | 'url'
  | 'external'
  | 'cloud-image-edit'
  | (string & {});

export const BUILTIN_ACTIVITIES = Object.freeze({
  START_FROM: 'start-from' as const,
  UPLOAD_LIST: 'upload-list' as const,
});

/**
 * Open declaration-merging surface for consumer-defined activities.
 * Plugins / consumers extend this with `declare module ... { interface
 * CustomActivities { 'my-activity': { params: { … } } } }` to get
 * typed `setCurrentActivity(...)` / `activity.subscribeToParams(...)`
 * calls. v1 hosted this on `LitActivityBlock`; v2 keeps the same shape
 * so consumer augmentations don't need to move.
 */
// biome-ignore lint/suspicious/noEmptyInterface: declaration-merging extension point
export interface CustomActivities {}

/**
 * v1-shape activity type union — backed by `BUILTIN_ACTIVITIES` plus
 * any consumer-defined `CustomActivities` keys. Includes `null` for the
 * "no current activity" state. Re-exported from the package root.
 */
export type ActivityType = (typeof BUILTIN_ACTIVITIES)[keyof typeof BUILTIN_ACTIVITIES] | keyof CustomActivities | null;
