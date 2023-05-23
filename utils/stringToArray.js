/**
 * @param {string} str
 * @returns {string[]}
 */
export const stringToArray = (str, delimiter = ',') => {
  return str
    .trim()
    .split(delimiter)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
};
