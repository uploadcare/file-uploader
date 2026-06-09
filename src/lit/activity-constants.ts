import type { CustomActivities } from './LitActivityBlock';

export const ACTIVITY_TYPES = Object.freeze({
  START_FROM: 'start-from',
  CAMERA: 'camera',
  UPLOAD_LIST: 'upload-list',
  URL: 'url',
  CLOUD_IMG_EDIT: 'cloud-image-edit',
  EXTERNAL: 'external',
});

export type RegisteredActivityType = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES] | keyof CustomActivities;
export type ActivityType = RegisteredActivityType | null;

/**
 * v2-native activity id: the built-in literals, consumer-augmented
 * `CustomActivities` keys, plus any string (`string & {}` keeps literal
 * autocomplete while accepting arbitrary plugin-registered ids). The
 * `string & {}` term keeps the union `string`-wide in every position, so —
 * unlike the bare `RegisteredActivityType` — it resolves consistently and the
 * `RouterController` can use it as its internal id type without the
 * narrow/wide split. Includes `keyof CustomActivities` so augmented activities
 * still get typed autocomplete.
 */
export type ActivityId = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES] | keyof CustomActivities | (string & {});
