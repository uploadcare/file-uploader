/**
 * @param {string} str
 * @returns {string}
 */
const escapeRegExp = function (str) {
  return str.replace(/[\\-\\[]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
};

/**
 * @param {string} str
 * @param {string} flags
 * @returns {RegExp}
 */
export const wildcardRegexp = function (str, flags = 'i') {
  const parts = str.split('*').map(escapeRegExp);
  return new RegExp('^' + parts.join('.+') + '$', flags);
};
