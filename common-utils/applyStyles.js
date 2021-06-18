/**
 * @param {HTMLElement} el
 * @param {Object<string, any>} styleObj
 */
export function applyStyles(el, styleObj) {
  for (let prop in styleObj) {
    el.style.setProperty(prop, styleObj[prop]);
  }
}
