/**
 * @template {string} T
 * @typedef {T extends `${infer Head} ${infer Tail}` ? `${Lowercase<Head>}-${KebabCase<Tail>}` : Lowercase<T>} KebabCase
 */

/**
 * @template {string} T
 * @param {T} str
 * @returns {KebabCase<T>}
 */
export const toKebabCase = (str) =>
  str
    .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
    ?.map((x) => x.toLowerCase())
    .join('-');
