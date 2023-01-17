/** @typedef {(count: number) => string} Pluralizer */

/** @type {Pluralizer} */
export const en = (count) => {
  return count === 1 ? 'one' : 'many';
};
