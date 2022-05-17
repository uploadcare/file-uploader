/**
 * @param {...(String | unknown)} [mimeTypes]
 * @returns {String}
 */
export const mergeMimeTypes = (...mimeTypes) => {
  return mimeTypes.filter((item) => typeof item === 'string' && item).join(',');
};
