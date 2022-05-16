/**
 * @param {String | unknown} [operation]
 * @returns {String}
 */
export const normalizeCdnOperation = (operation) => {
  if (typeof operation !== 'string' || !operation) {
    return '';
  }
  let str = operation.trim();
  if (str.startsWith('-/')) {
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
 * @param {String} baseUrl
 * @param {String} [cdnModifiers]
 * @param {String} [filename]
 * @returns {String}
 */
export const createCdnUrl = (baseUrl, cdnModifiers, filename) => {
  return withTrailingSlash(baseUrl) + (cdnModifiers || '') + (filename || '');
};

/**
 * @param {String} cdnBase
 * @param {String} uuid
 * @returns {String}
 */
export const createOriginalUrl = (cdnBase, uuid) => {
  return withTrailingSlash(cdnBase) + uuid + '/';
};
