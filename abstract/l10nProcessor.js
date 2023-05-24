/**
 * @template {import('./Block.js').Block} T
 * @param {DocumentFragment} fr
 * @param {T} fnCtx
 */
export function l10nProcessor(fr, fnCtx) {
  [...fr.querySelectorAll('[l10n]')].forEach((el) => {
    let key = el.getAttribute('l10n');
    let elProp = 'textContent';
    if (key.includes(':')) {
      let arr = key.split(':');
      elProp = arr[0];
      key = arr[1];
    }
    let ctxKey = 'l10n:' + key;
    // @ts-ignore
    fnCtx.__l10nKeys.push(ctxKey);
    fnCtx.add(ctxKey, key);
    fnCtx.sub(ctxKey, (val) => {
      el[elProp] = fnCtx.l10n(val);
    });
    el.removeAttribute('l10n');
  });
}
