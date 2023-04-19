/**
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export const uniqueArray = (arr) => {
  return [...new Set(arr)];
};
