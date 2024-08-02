// @ts-check

import { DICT } from '@symbiotejs/symbiote';

const FALLBACK_BIND_ATTR = 'set';

/** @param {DocumentFragment | import('@symbiotejs/symbiote').Symbiote<any>} fr */
export function bindCompatibilityFallbackProcessor(fr) {
  [...fr.querySelectorAll(`[${FALLBACK_BIND_ATTR}]`)].forEach((el) => {
    const setAttrValue = el.getAttribute(FALLBACK_BIND_ATTR);
    if (setAttrValue) {
      el.removeAttribute(FALLBACK_BIND_ATTR);
      el.setAttribute(DICT.BIND_ATTR, setAttrValue);
    }
  });
}
