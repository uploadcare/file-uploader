import { DEFAULT_CDN_ORIGIN } from '../../utils/cdn/origin';

/** `flag: true` marks the documented "number flag" settings, whose attribute value is read as a number. */
export const PROPS_MAP = Object.freeze({
  'dev-mode': { flag: true },
  pubkey: {},
  uuid: {},
  src: {},
  // alt: {},
  // 'placeholder-src': {}, // available via CSS
  lazy: {
    default: 1,
    flag: true,
  },
  intersection: { flag: true },
  breakpoints: {
    // '200, 300, 400'
  },
  'cdn-cname': {
    default: DEFAULT_CDN_ORIGIN,
  },
  'proxy-cname': {},
  'secure-delivery-proxy': {},
  'hi-res-support': {
    default: 1,
    flag: true,
  },
  'ultra-res-support': { flag: true },
  format: {},
  'cdn-operations': {},
  progressive: { flag: true },
  quality: {},
  'is-background-for': {},
  'is-preview-blur': {
    default: 1,
    flag: true,
  },
});

export type ImgPropKey = keyof typeof PROPS_MAP;
