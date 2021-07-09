const STATE_ATTR = 'set';

/**
 * @param {DocumentFragment} fr
 * @returns {Object<string, HTMLElement>}
 */
export function getState(fr) {
  return [...fr.querySelectorAll(`[${STATE_ATTR}]`)].reduce((refs, el) => {
    refs[el.getAttribute(STATE_ATTR)] = el;
    el.removeAttribute(STATE_ATTR);
    return refs;
  }, {});
}
