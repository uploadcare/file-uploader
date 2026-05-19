import { DEFAULT_CDN_CNAME } from '../blocks/Config/initialConfig';

type ParseCdnUrlOptions = {
  url: string;
  cdnBase: string;
};

type ParseCdnUrlResult = {
  uuid: string;
  cdnUrlModifiers: string;
  filename: string | null;
};

const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
const cdnUrlRegex = new RegExp(`^/?(${uuidRegex.source})(?:/(-/(?:[^/]+/)+)?([^/]*))?$`, 'i');

export const parseCdnUrl = ({ url, cdnBase }: ParseCdnUrlOptions): ParseCdnUrlResult | null => {
  const cdnBaseUrlObj = new URL(cdnBase);
  const fallbackCdnBaseUrlObj = new URL(DEFAULT_CDN_CNAME);
  const urlObj = new URL(url);

  if (cdnBaseUrlObj.host !== urlObj.host && fallbackCdnBaseUrlObj.host !== urlObj.host) {
    return null;
  }

  const match = cdnUrlRegex.exec(urlObj.pathname);

  if (!match) {
    return null;
  }

  const [, uuid, cdnUrlModifiers, filename] = match;

  if (!uuid) {
    return null;
  }

  return {
    uuid,
    cdnUrlModifiers: cdnUrlModifiers || '',
    filename: filename || null,
  };
};
