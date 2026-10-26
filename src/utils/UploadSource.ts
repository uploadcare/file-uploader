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

export type ExternalSourceType = (typeof ExternalUploadSource)[keyof typeof ExternalUploadSource];

export const isExternalSource = (source: string): source is ExternalSourceType =>
  (Object.values(ExternalUploadSource) as string[]).includes(source);

/** An alias shares the display name, icon and translation key of the source it stands for. */
const canonicalExternalSource = (source: ExternalSourceType) =>
  source === ExternalUploadSource.DROPBOX_CHOOSER ? ExternalUploadSource.DROPBOX : source;

/** The translation key of an external source's name. */
export type ExternalSourceLabelKey = `src-type-${ReturnType<typeof canonicalExternalSource>}`;

export const sourceLabelKey = (source: ExternalSourceType): ExternalSourceLabelKey =>
  `src-type-${canonicalExternalSource(source)}`;
