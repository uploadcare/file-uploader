export const ACTIVITY_TYPES = Object.freeze({
  START_FROM: 'start-from',
  CAMERA: 'camera',
  DRAW: 'draw',
  UPLOAD_LIST: 'upload-list',
  URL: 'url',
  CLOUD_IMG_EDIT: 'cloud-image-edit',
  EXTERNAL: 'external',
});

export type RegisteredActivityType = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES];
export type ActivityType = RegisteredActivityType | (string & {}) | null;
