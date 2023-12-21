const DEFAULT_CDN_BASE = 'https://ucarecdn.com';

export const PROPS_MAP = Object.freeze({
  'dev-mode': {},
  pubkey: {},
  uuid: {},
  src: {},
  // alt: {},
  // 'placeholder-src': {}, // available via CSS
  lazy: {
    default: 1,
  },
  intersection: {},
  breakpoints: {
    // '200, 300, 400'
  },
  'cdn-cname': {
    default: DEFAULT_CDN_BASE,
  },
  'proxy-cname': {},
  'secure-delivery-proxy': {},
  'hi-res-support': {
    default: 1,
  },
  'ultra-res-support': {}, // ?
  format: {
    default: 'auto',
  },
  'cdn-operations': {},
  progressive: {},
  quality: {
    default: 'smart',
  },
  'is-background-for': {},
  'is-preview-blur': {
    default: 1,
  },
});
