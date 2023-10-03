// @ts-check

/**
 * @param {Function} fn
 * @param {number} wait
 */
export const throttle = (fn, wait) => {
  /** @type {boolean} */
  let inThrottle;
  /** @type {ReturnType<typeof setTimeout>} */
  let lastFn;
  /** @type {number} */
  let lastTime;
  /** @param {...any} args */
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      lastTime = Date.now();
      inThrottle = true;
    } else {
      clearTimeout(lastFn);
      lastFn = setTimeout(() => {
        if (Date.now() - lastTime >= wait) {
          fn(...args);
          lastTime = Date.now();
        }
      }, Math.max(wait - (Date.now() - lastTime), 0));
    }
  };
};
