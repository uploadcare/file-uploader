import { DICT, type Symbiote } from '@symbiotejs/symbiote';

const FALLBACK_BIND_ATTR = 'set';

export function bindCompatibilityFallbackProcessor(fr: DocumentFragment | Symbiote<any>): void {
  [...fr.querySelectorAll(`[${FALLBACK_BIND_ATTR}]`)].forEach((el) => {
    const setAttrValue = el.getAttribute(FALLBACK_BIND_ATTR);
    if (setAttrValue) {
      el.removeAttribute(FALLBACK_BIND_ATTR);
      el.setAttribute(DICT.BIND_ATTR, setAttrValue);
    }
  });
}
