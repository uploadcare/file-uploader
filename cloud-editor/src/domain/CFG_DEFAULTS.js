export const CFG_DEFAULTS = {
  pubkey: 'demopublickey',
  theme: {},
  multiple: true,
  lang: 'en-EN',
  store: true,
  customtranslations: {},
  allowduplicates: false,
  accept: [],
  // validate: {
  //   custom: false,
  //   formats: [],
  //   maxFileSize: null,
  //   minFileSize: null,
  //   maxFiles: null,
  //   minFiles: null,
  //   imagesOnly: false,
  // },
  // automate: {
  //   resize: null,
  //   crop: null,
  //   shrink: null,
  // },
  sources: ['local', 'camera', 'url', 'dropbox', 'gdrive', 'fb'],
  // security: {
  //   signature: null,
  //   expire: null,
  //   permanentRemoval: true,
  // },
  // previewproxy: '',
  // media: {
  //   audio: {
  //     bps: null,
  //   },
  //   video: {
  //     bps: null,
  //   },
  // },
  camera: {
    mirror: true,
  },
  // allowlist: true,
  // allowpreview: true,
  // alloweditor: true,
  dropzone: true,
};
