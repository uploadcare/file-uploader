import { DEFAULT_CDN_CNAME } from '../blocks/Config/initialConfig.js';

const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
const cdnUrlRegex = new RegExp(`^/?(${uuidRegex.source})(?:/(-/(?:[^/]+/)+)?([^/]*))?$`, 'i');

/** @param {{ url: string; cdnBase: string }} options */
export const parseCdnUrl = ({ url, cdnBase }) => {
  const cdnBaseUrlObj = new URL(cdnBase);
  const fallbackCdnBaseUrlObj = new URL(DEFAULT_CDN_CNAME);
  const urlObj = new URL(url);

  if (cdnBaseUrlObj.host !== urlObj.host && fallbackCdnBaseUrlObj.host !== urlObj.host) {
    return null;
  }

  const [, uuid, cdnUrlModifiers, filename] = cdnUrlRegex.exec(urlObj.pathname);

  return {
    uuid,
    cdnUrlModifiers: cdnUrlModifiers || '',
    filename: filename || null,
  };
};
