// @ts-check

/**
 * @param {unknown} value
 * @returns {value is Promise}
 */
export const isPromiseLike = (value) => {
  return (
    value instanceof Promise ||
    Boolean(value && typeof value === 'object' && 'then' in value && typeof value.then === 'function')
  );
};
