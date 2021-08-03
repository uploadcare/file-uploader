const ALLOWED_PROPS = ['--rgb-primary-accent'];

// TODO: maybe should be moved right into logger core
let warnOnce = (() => {
  let cache = new Set();

  return (...args) => {
    let key = JSON.stringify(args);
    if (!cache.has(key)) {
      console.warn(.../** @type {[string, object]} */ (args));
    }
    cache.add(key);
  };
})();

export function themeFilter(themeObj) {
  let filtered = {};
  for (let prop in themeObj) {
    if (ALLOWED_PROPS.includes(prop)) {
      filtered[prop] = themeObj[prop];
    } else {
      warnOnce(`It's not allowed to modify "${prop}" property`, { scope: 'theme' });
    }
  }
  return filtered;
}
