import { logger } from '../abstract/logger';
import { DEFAULT_CDN_CNAME } from '../blocks/Config/initialConfig';
import { parseFileUrl, serializeOperations } from './cdn';

const log = logger.scope('parse-cdn-url');

type ParseCdnUrlOptions = {
  url: string;
  cdnBase: string;
};

type ParseCdnUrlResult = {
  uuid: string;
  cdnUrlModifiers: string;
  filename: string | null;
};

/**
 * Parse a CDN URL into the pieces an upload entry needs. Backs the documented
 * `addFileFromCdnUrl`, which turns a `null` here into `Error('Invalid CDN URL')`,
 * so every rejection path must keep returning `null` rather than throwing.
 *
 * The host policy is ours, not the library's: `@uploadcare/cdn-url` is
 * origin-agnostic, while this accepts a URL on the configured `cdnBase` **or** on
 * the default `ucarecdn.com` — a project that has moved to a custom cname can
 * still add files by their canonical URL. Comparison is by host, so the protocol
 * and any trailing slash on `cdnBase` are ignored.
 *
 * Only plain single-file URLs are accepted. Group URLs, delivery-proxy URLs and
 * conversion results (`/:uuid/video/…`) parse fine but have no representation in
 * an upload entry — `ParseCdnUrlResult` has nowhere to put a group id, a remote
 * source or a conversion prefix, and silently dropping either would corrupt the
 * entry. They were rejected before this module used the library, and still are.
 */
export const parseCdnUrl = ({ url, cdnBase }: ParseCdnUrlOptions): ParseCdnUrlResult | null => {
  let cdnBaseUrlObj: URL;
  let fallbackCdnBaseUrlObj: URL;
  let urlObj: URL;
  try {
    cdnBaseUrlObj = new URL(cdnBase);
    fallbackCdnBaseUrlObj = new URL(DEFAULT_CDN_CNAME);
    urlObj = new URL(url);
  } catch (err) {
    log.warn('Not a CDN URL', err);
    return null;
  }

  if (cdnBaseUrlObj.host !== urlObj.host && fallbackCdnBaseUrlObj.host !== urlObj.host) {
    return null;
  }

  let parsed: ReturnType<typeof parseFileUrl>;
  try {
    parsed = parseFileUrl(url);
  } catch (err) {
    log.warn('Not a CDN URL', err);
    return null;
  }

  if (parsed.conversion) {
    return null;
  }

  return {
    uuid: parsed.uuid,
    cdnUrlModifiers: serializeOperations(parsed.operations),
    filename: parsed.filename,
  };
};
