/**
 * @template {Function} T
 * @param {T} callback
 * @param {number} wait
 * @returns {T & { cancel: function }}
 */
export function debounce(callback, wait) {
  let timer;
  /** @type {any} */
  let debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), wait);
  };
  debounced.cancel = () => {
    clearTimeout(timer);
  };
  return debounced;
}
