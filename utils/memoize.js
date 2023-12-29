// @ts-check

/**
 * @template {unknown[]} TArgs
 * @template {unknown} TReturn
 * @param {(...args: TArgs) => TReturn} fn
 * @returns {(...args: TArgs) => TReturn}
 */
export const memoize = (fn) => {
  const cache = new Map();
  /** @param {TArgs} args */
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};
