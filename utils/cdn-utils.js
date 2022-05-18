const NORMALIZE_REGEX = /(^-\/|^\/)|(\/$)/g;
const FILENAME_OR_FILE_URL_REGEX = /\/(http.+$|[^\/]+$)/;

/**
 * Trim leading `-/`, `/` and trailing `/` from CDN operation
 *
 * @param {String | unknown} [operation]
 * @returns {String}
 */
export const normalizeCdnOperation = (operation) => {
  if (typeof operation !== 'string' || !operation) {
    return '';
  }
  return operation.replace(NORMALIZE_REGEX, '');
};

/**
 * Join multiple CDN operations into one string without trailing or leading delimeters
 *
 * @param {...(String | unknown)} [operations]
 * @returns {String}
 */
export const joinCdnOperations = (...operations) => {
  return operations
    .filter((op) => typeof op === 'string' && op)
    .map((op) => normalizeCdnOperation(/** @type {String} */ (op)))
    .join('/-/');
};

/**
 * Create string with leading `-/` from passed CDN operations. Do the same as `joinCdnOperations` but adds leading `-/`
 * and trailing `/`
 *
 * @param {...(String | unknown)} [cdnOperations] -
 * @returns {String}
 */
export const createCdnUrlModifiers = (...cdnOperations) => {
  let joined = joinCdnOperations(...cdnOperations);
  return joined ? `-/${joined}/` : '';
};

/**
 * Extract filename or file URL
 *
 * @param {String} cdnUrl
 * @returns {String}
 */
export function extractFilename(cdnUrl) {
  let url = new URL(cdnUrl);
  let noOrigin = url.pathname + url.search + url.hash;
  let match = noOrigin.match(FILENAME_OR_FILE_URL_REGEX);
  return match?.[1] || '';
}

/**
 * Trim filename or file URL
 *
 * @param {String} cdnUrl
 * @returns {String}
 */
export function trimFilename(cdnUrl) {
  let url = new URL(cdnUrl);
  url.pathname = url.pathname.replace(FILENAME_OR_FILE_URL_REGEX, '/');
  url.search = '';
  url.hash = '';
  return url.toString();
}

/**
 * Detect if filename is actually file URL
 *
 * @param {String} filename
 * @returns {Boolean}
 */
export function isFileUrl(filename) {
  return filename.startsWith('http');
}

/**
 * Split file URL into the path and search parts
 *
 * @param {String} fileUrl
 * @returns {{ pathname: String; search: String; hash: String }}
 */
export function splitFileUrl(fileUrl) {
  let url = new URL(fileUrl);
  return {
    pathname: url.origin + url.pathname || '',
    search: url.search || '',
    hash: url.hash || '',
  };
}

/**
 * Create a final CDN URL with CDN modifiers and filename
 *
 * @param {String} baseCdnUrl - Base URL to CDN or Proxy, CDN modifiers and filename accepted
 * @param {String} [cdnModifiers] - CDN modifiers to apply, will be appended to `baseCdnUrl` ones
 * @param {String} [filename] - Filename for CDN or file URL for Proxy, will override one from `baseCdnUrl`
 * @returns {String}
 */
export const createCdnUrl = (baseCdnUrl, cdnModifiers, filename) => {
  let url = new URL(trimFilename(baseCdnUrl));
  filename = filename || extractFilename(baseCdnUrl);

  if (isFileUrl(filename)) {
    let splitted = splitFileUrl(filename);
    url.pathname = url.pathname + (cdnModifiers || '') + (splitted.pathname || '');
    url.search = splitted.search;
    url.hash = splitted.hash;
  } else {
    url.pathname = url.pathname + (cdnModifiers || '') + (filename || '');
  }

  return url.toString();
};

/**
 * Create URL for an original file on CDN
 *
 * @param {String} cdnUrl - URL to get base domain from, any pathname will be stripped
 * @param {String} uuid
 * @returns {String}
 */
export const createOriginalUrl = (cdnUrl, uuid) => {
  let url = new URL(cdnUrl);
  url.pathname = uuid + '/';
  return url.toString();
};
