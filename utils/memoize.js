// @ts-check

/**
 * @template {any[]} TArgs
 * @template {any} TReturn
 * @template {(...args: TArgs) => TReturn} T
 * @param {T} fn
 * @returns {T}
 */
export const memoize = (fn) => {
  const cache = new Map();
  return /** @type {T} */ (
    (...args) => {
      const key = JSON.stringify(args);
      if (cache.has(key)) {
        return cache.get(key);
      }
      const result = fn(...args);
      cache.set(key, result);
      return result;
    }
  );
};
