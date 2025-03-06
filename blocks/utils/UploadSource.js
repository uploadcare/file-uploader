// @ts-check
export const ExternalUploadSource = Object.freeze({
  FACEBOOK: 'facebook',
  DROPBOX: 'dropbox',
  GDRIVE: 'gdrive',
  GPHOTOS: 'gphotos',
  FLICKR: 'flickr',
  VK: 'vk',
  EVERNOTE: 'evernote',
  BOX: 'box',
  ONEDRIVE: 'onedrive',
  HUDDLE: 'huddle',
});

export const UploadSourceMobile = Object.freeze({
  MOBILE_VIDEO_CAMERA: 'mobile-video-camera',
  MOBILE_PHOTO_CAMERA: 'mobile-photo-camera',
});

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
});

/** @typedef {(typeof UploadSource)[keyof typeof UploadSource]} SourceTypes */
