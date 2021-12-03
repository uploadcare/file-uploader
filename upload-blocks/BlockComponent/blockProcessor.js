export function blockProcessor(fr, fnCtx) {
  [...fr.querySelectorAll('[l10n]')].forEach((el) => {
    let key = el.getAttribute('l10n');
    let elProp = 'textContent';
    if (key.includes(':')) {
      let arr = key.split(':');
      elProp = arr[0];
      key = arr[1];
    }
    let ctxKey = 'l10n:' + key;
    fnCtx.__l10nKeys.push(ctxKey);
    fnCtx.add(ctxKey, key);
    fnCtx.sub(ctxKey, (val) => {
      el[elProp] = fnCtx.l10n(val);
    });
    el.removeAttribute('l10n');
  });
  [...fr.querySelectorAll('*')].forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (attr.name.startsWith('.')) {
        el.classList.add(attr.name.replace('.', ''));
        el.removeAttribute(attr.name);
      }
    });
  });
}
