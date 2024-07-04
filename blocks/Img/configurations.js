export const CSS_PREF = '--uc-img-';
export const UNRESOLVED_ATTR = 'unresolved';
export const HI_RES_K = 2;
export const ULTRA_RES_K = 3;
export const DEV_MODE =
  !window.location.host.trim() || window.location.host.includes(':') || window.location.hostname.includes('localhost');

export const MAX_WIDTH = 3000;
export const MAX_WIDTH_JPG = 5000;

export const ImgTypeEnum = Object.freeze({
  PREVIEW: 'PREVIEW',
  MAIN: 'MAIN',
});
