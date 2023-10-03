// @ts-check

/**
 * @template {{ (...args: any[]): any }} T
 * @param {T} callback
 * @param {number} wait
 * @returns {T & { cancel: () => void }} }
 */
export function debounce(callback, wait) {
  /** @type {NodeJS.Timeout} */
  let timer;
  const debounced =
    /** @param {...any} args */
    (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => callback(...args), wait);
    };
  debounced.cancel = () => {
    clearTimeout(timer);
  };
  return /** @type {T & { cancel: () => void }} } */ (debounced);
}
