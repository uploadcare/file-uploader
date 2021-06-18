const STAE_ATTR = 'set';

/**
 * @param {DocumentFragment} fr
 * @returns {Object<string, HTMLElement>}
 */
export function getState(fr) {
  return [...fr.querySelectorAll(`[${STAE_ATTR}]`)].reduce((refs, el) => {
    refs[el.getAttribute(STAE_ATTR)] = el;
    el.removeAttribute(STAE_ATTR);
    return refs;
  }, {});
}
