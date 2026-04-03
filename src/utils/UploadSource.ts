export const ExternalUploadSource = Object.freeze({
  FACEBOOK: 'facebook',
  DROPBOX: 'dropbox',
  DROPBOX_CHOOSER: 'dropboxchooser',
  GDRIVE: 'gdrive',
  GPHOTOS: 'gphotos',
  FLICKR: 'flickr',
  VK: 'vk',
  EVERNOTE: 'evernote',
  BOX: 'box',
  ONEDRIVE: 'onedrive',
  HUDDLE: 'huddle',
} as const);

export const UploadSourceMobile = Object.freeze({
  MOBILE_VIDEO_CAMERA: 'mobile-video-camera',
  MOBILE_PHOTO_CAMERA: 'mobile-photo-camera',
} as const);

export const UploadSource = Object.freeze({
  LOCAL: 'local',
  DROP_AREA: 'drop-area',
  CAMERA: 'camera',
  EXTERNAL: 'external',
  API: 'js-api',
  URL: 'url',
  DRAW: 'draw',

  ...UploadSourceMobile,
  ...ExternalUploadSource,
} as const);

export type SourceTypes = (typeof UploadSource)[keyof typeof UploadSource];

const SOURCE_L10N_KEY_MAP: Partial<Record<SourceTypes, SourceTypes>> = {
  [ExternalUploadSource.DROPBOX_CHOOSER]: ExternalUploadSource.DROPBOX,
};

/** Returns the canonical name for a source, mapping aliases to their shared display name, icon, and translation key. */
export const canonicalSourceName = (source: string): string => SOURCE_L10N_KEY_MAP[source as SourceTypes] ?? source;
