const REF_ATTR = 'ref';

/**
 * @param {DocumentFragment} fr
 * @returns {Object<string, any>}
 */
export function getRefs(fr) {
  return [...fr.querySelectorAll(`[${REF_ATTR}]`)].reduce((refs, el) => {
    refs[el.getAttribute(REF_ATTR)] = el;
    el.removeAttribute(REF_ATTR);
    return refs;
  }, {});
}
