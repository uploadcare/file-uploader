/**
 * @param {String} html
 * @returns {any}
 */
export function renderToFragment(html) {
  let fr = new DocumentFragment();
  let tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  [...tempDiv.children].forEach((el) => {
    fr.appendChild(el);
  });
  tempDiv = null;
  return fr;
}
