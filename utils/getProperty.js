/**
 * TODO: we have the same implementation inside symbiote core
 *
 * @param {Object} obj
 * @param {String} path
 * @returns {unknown}
 */
export function getProperty(obj, path) {
  if (!obj) {
    return undefined;
  }
  if (!path.includes('.')) {
    return obj[path];
  }

  let parent = obj,
    lastStep;
  let propPath = path.split('.');

  propPath.forEach((step, idx) => {
    if (idx < propPath.length - 1) {
      parent = parent[step];
    } else {
      lastStep = step;
    }
  });

  if (lastStep && parent) {
    return parent[lastStep];
  }

  return undefined;
}
