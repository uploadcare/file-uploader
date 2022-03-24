/**
 * @param {{}} obj
 * @param {String[]} keys
 * @returns {{}}
 */
export function pick(obj, keys) {
  let result = {};
  for (let key of keys) {
    let value = obj[key];
    if (obj.hasOwnProperty(key) || value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}
