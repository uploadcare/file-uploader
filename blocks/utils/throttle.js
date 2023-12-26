// @ts-check

/**
 * @template {{ (...args: any[]): void }} T
 * @param {T} fn
 * @param {number} wait
 * @returns {T & { readonly cancel: () => void }} }
 */
export const throttle = (fn, wait) => {
  /** @type {boolean} */
  let inThrottle;
  /** @type {ReturnType<typeof setTimeout>} */
  let lastFn;
  /** @type {number} */
  let lastTime;
  /** @param {...any} args */
  const throttled = (...args) => {
    if (!inThrottle) {
      fn(...args);
      lastTime = Date.now();
      inThrottle = true;
    } else {
      clearTimeout(lastFn);
      lastFn = setTimeout(
        () => {
          if (Date.now() - lastTime >= wait) {
            fn(...args);
            lastTime = Date.now();
          }
        },
        Math.max(wait - (Date.now() - lastTime), 0),
      );
    }
  };
  Object.defineProperty(throttled, 'cancel', {
    configurable: false,
    writable: false,
    enumerable: false,
    value: () => {
      clearTimeout(lastFn);
    },
  });

  return /** @type {T & { readonly cancel: () => void }} */ (/** @type {unknown} */ (throttled));
};
