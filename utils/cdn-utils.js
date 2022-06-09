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
  let str = operation.trim();
  // TODO: refactor
  if (str.startsWith('/-/')) {
    str = str.slice(3);
  } else if (str.startsWith('-/')) {
    str = str.slice(2);
  } else if (str.startsWith('/')) {
    str = str.slice(1);
  }

  if (str.endsWith('/')) {
    str = str.slice(0, str.length - 1);
  }
  return str;
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
  let withoutOrigin = url.pathname + url.search + url.hash;
  let urlFilenameIdx = withoutOrigin.lastIndexOf('http');
  let plainFilenameIdx = withoutOrigin.lastIndexOf('/');
  let filename = '';

  if (urlFilenameIdx >= 0) {
    filename = withoutOrigin.slice(urlFilenameIdx);
  } else if (plainFilenameIdx >= 0) {
    filename = withoutOrigin.slice(plainFilenameIdx + 1);
  }

  return filename;
}

/**
 * Extract cname from CDN URL
 *
 * @param {String} cdnUrl
 * @returns {String}
 */
export function extractCname(cdnUrl) {
  let url = new URL(cdnUrl);
  return url.origin;
}

/**
 * Extract cdn modifiers from CDN URL
 *
 * @param {String} cdnUrl
 * @returns {String}
 */
export function extractCdnModifiers(cdnUrl) {
  let withoutFilename = trimFilename(cdnUrl);
  let url = new URL(withoutFilename);
  let pathname = url.pathname;
  let startIdx = pathname.indexOf('/-/');
  if (startIdx === -1) {
    return '';
  }
  let modifiers = createCdnUrlModifiers(pathname.slice(startIdx));
  return modifiers;
}

/**
 * Extract uuid from CDN URL
 *
 * @param {String} cdnUrl
 * @returns {String}
 */
export function extractUuid(cdnUrl) {
  let url = new URL(cdnUrl);
  let pathname = url.pathname;
  let secondSlashIdx;
  for (let i = 1; i < pathname.length; i++) {
    if (pathname[i] === '/') {
      secondSlashIdx = i;
      break;
    }
  }
  if (!secondSlashIdx) {
    throw new Error(`Failed to extract UUID from "${cdnUrl}"`);
  }
  let uuid = pathname.substring(1, secondSlashIdx);
  return uuid;
}

/**
 * Trim filename or file URL
 *
 * @param {String} cdnUrl
 * @returns {String}
 */
export function trimFilename(cdnUrl) {
  let url = new URL(cdnUrl);
  let filename = extractFilename(cdnUrl);
  let filenamePathPart = isUrl(filename) ? splitFileUrl(filename).pathname : filename;

  url.pathname = url.pathname.replace(filenamePathPart, '');
  url.search = '';
  url.hash = '';
  return url.toString();
}

/**
 * Detect if input string is URL
 *
 * @param {String} input
 * @returns {Boolean}
 */
export function isUrl(input) {
  return input.startsWith('http');
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

  if (isUrl(filename)) {
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
 * @param {String} urlOrCname - URL to get base domain from, any pathname will be stripped
 * @param {String} uuid
 * @returns {String}
 */
export const createOriginalUrl = (urlOrCname, uuid) => {
  let url = new URL(urlOrCname);
  url.pathname = uuid + '/';
  return url.toString();
};

export class CdnUrl {
  /**
   * @private
   * @type {String}
   */
  _cname = '';

  /**
   * @private
   * @type {String}
   */
  _uuid = '';

  /**
   * @private
   * @type {String}
   */
  _modifiers = '';

  /**
   * @private
   * @type {String}
   */
  _filename = '';

  /** @param {String} [cdnUrl] */
  constructor(cdnUrl = '') {
    if (!cdnUrl) {
      return;
    }
    this._filename = extractFilename(cdnUrl);
    this._cname = extractCname(cdnUrl);
    this._uuid = extractUuid(cdnUrl);
    this._modifiers = extractCdnModifiers(cdnUrl);
  }

  /** @returns {String} */
  get cname() {
    return this._cname;
  }
  /** @returns {String} */
  get uuid() {
    return this._uuid;
  }
  /** @returns {String} */
  get filename() {
    return this._filename;
  }
  /** @returns {String} */
  get modifiers() {
    return this._modifiers;
  }

  /** @param {String} cname */
  set cname(cname) {
    this._cname = cname;
  }
  /** @param {String} uuid */
  set uuid(uuid) {
    this._uuid = uuid;
  }
  /** @param {String} filename */
  set filename(filename) {
    this._filename = filename;
  }
  /** @param {String} modifiers */
  set modifiers(modifiers) {
    this._modifiers = createCdnUrlModifiers(modifiers);
  }

  toString() {
    return createCdnUrl(
      createOriginalUrl(this._cname, this._uuid),
      createCdnUrlModifiers(this._modifiers),
      this._filename
    );
  }
}
