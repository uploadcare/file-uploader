export const ExternalUploadSource = Object.freeze({
  FACEBOOK: 'facebook',
  DROPBOX: 'dropbox',
  DROPBOX_CHOOSER: 'dropboxchooser',
  GDRIVE: 'gdrive',
  GPHOTOS: 'gphotos',
  BOX: 'box',
  ONEDRIVE: 'onedrive',
} as const);

/** A source that was removed; its id still turns up in `sourceList`, where it gets an explanation. */
export const INSTAGRAM_SOURCE = 'instagram';

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

  ...UploadSourceMobile,
  ...ExternalUploadSource,
} as const);

export type SourceTypes = (typeof UploadSource)[keyof typeof UploadSource];

const SOURCE_L10N_KEY_MAP: Partial<Record<SourceTypes, SourceTypes>> = {
  [ExternalUploadSource.DROPBOX_CHOOSER]: ExternalUploadSource.DROPBOX,
};

/** Returns the canonical name for a source, mapping aliases to their shared display name, icon, and translation key. */
export const canonicalSourceName = (source: string): string => SOURCE_L10N_KEY_MAP[source as SourceTypes] ?? source;

/** The translation key of a source's name; an alias shares the key of the source it stands for. */
export const sourceLabelKey = (source: string): string => `src-type-${canonicalSourceName(source)}`;
