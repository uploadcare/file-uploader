/**
 * @param {String} tagName
 * @param {Object<string, any>} [options]
 * @param {Object<string, any>} [attributes]
 */
export function createElement(tagName, options = {}, attributes = {}) {
  let el = document.createElement(tagName);
  for (let opt in options) {
    el[opt] = options[opt];
  }
  for (let attr in attributes) {
    el.setAttribute(attr, attributes[attr]);
  }
  return el;
}
