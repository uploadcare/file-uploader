/**
 * @param {String | unknown} [operation]
 * @returns {String}
 */
export const normalizeCdnOperation = (operation) => {
  if (typeof operation !== 'string' || !operation) {
    return '';
  }
  let str = operation.trim();
  let start = 0;
  let end = str.length;
  if (str.startsWith('-/')) {
    start = 2;
  } else if (str.startsWith('/')) {
    start = 1;
  }

  if (str.endsWith('/')) {
    end = str.length - 1;
  }
  return str.substring(start, end);
};

/**
 * @param {...(String | unknown)} operations
 * @returns {String}
 */
export const joinCdnOperations = (...operations) => {
  return operations
    .filter((op) => typeof op === 'string' && op)
    .map((op) => normalizeCdnOperation(/** @type {String} */ (op)))
    .join('/-/');
};

/**
 * @param {...(String | unknown)} [cdnOperations]
 * @returns {String}
 */
export const createCdnUrlModifiers = (...cdnOperations) => {
  let joined = joinCdnOperations(...cdnOperations);
  return joined ? `-/${joined}/` : '';
};

/**
 * @param {String} input
 * @returns {String}
 */
function withTrailingSlash(input) {
  if (!input.endsWith('/')) {
    input = input + '/';
  }
  return input;
}

/**
 * `cdnUrl` is expected to be a:
 *
 * - Just `cdnBase` with or without trailing slash
 * - `cdnBase` + `uuid` + `filename` with trailing slash
 * - `cdnBase` + `uuid` + `cdnModifiers` + `filename` with trailing slash
 *
 * @param {String} cdnUrl
 * @returns {String}
 */
export function extractFilename(cdnUrl) {
  let protocolSlashesIdx = cdnUrl.indexOf('//');
  let lastSlashIndex = cdnUrl.lastIndexOf('/');
  // if last slash is protocol double slash, then it's just a cdnBase
  if (protocolSlashesIdx + 1 === lastSlashIndex) {
    return '';
  }
  return cdnUrl.substring(lastSlashIndex + 1);
}

/**
 * @param {String} cdnUrl
 * @returns {String}
 */
export function trimFilename(cdnUrl) {
  let filename = extractFilename(cdnUrl);
  let filenameIdx = cdnUrl.lastIndexOf(filename);
  if (filenameIdx + filename.length === cdnUrl.length) {
    return (cdnUrl = cdnUrl.substring(0, filenameIdx));
  }
  return cdnUrl;
}

/**
 * @param {String} baseCdnUrl
 * @param {String} [cdnModifiers]
 * @param {String} [filename]
 * @returns {String}
 */
export const createCdnUrl = (baseCdnUrl, cdnModifiers, filename) => {
  filename = filename || extractFilename(baseCdnUrl);
  return withTrailingSlash(trimFilename(baseCdnUrl)) + (cdnModifiers || '') + (filename || '');
};

/**
 * @param {String} cdnBase
 * @param {String} uuid
 * @returns {String}
 */
export const createOriginalUrl = (cdnBase, uuid) => {
  return withTrailingSlash(cdnBase) + uuid + '/';
};
