/**
 * @param {String} html
 * @returns {String}
 */
export function colorCode(html) {
  return html
    .replace(/&lt;/g, '<span -tag-arr->&lt;</span>')
    .replace(/&gt;/g, '<span -tag-arr->&gt;</span>')
    .split('="')
    .map((chunk) => {
      return chunk.replace('"', '</span>"');
    })
    .join(`="<span -attr->`)
    .replace(/"/g, '<span -quote->"</span>')
    .replace(/=/g, '<span -equal->=</span>')
    .split('<span -tag-arr->&lt;</span>/')
    .join('<span -tag-arr->&lt;/</span>')
    .split('<span -tag-arr->&lt;</span>!--')
    .join('<span -comment->&lt;!--')
    .split('--<span -tag-arr->&gt;</span>')
    .join('--&gt;</span>')

    .split('<span -tag-arr->&lt;</span>style<span -tag-arr->&gt;</span>')
    .join('<span -tag-arr->&lt;</span>style<span -tag-arr->&gt;</span><span -style->')

    .split('<span -tag-arr->&lt;/</span>style<span -tag-arr->&gt;</span>')
    .join('</span><span -tag-arr->&lt;/</span>style<span -tag-arr->&gt;</span>');
}

let codeElements = [...document.querySelectorAll('code')];
let tmpEl = document.createElement('div');
codeElements.forEach((codeEl) => {
  tmpEl.textContent = codeEl.innerHTML;
  codeEl.innerHTML = colorCode(tmpEl.textContent);
});
