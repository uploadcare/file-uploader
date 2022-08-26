import { marked } from 'marked';
import hljs from 'highlight.js';

marked.setOptions({
  highlight: (code, lang, callback) => {
    // @ts-ignore
    code = hljs.highlight(code, { language: lang }).value;
    callback && callback(undefined, code);
  },
});

/**
 * @param {String} md
 * @returns
 */
function md2html(md) {
  return new Promise((resolve, reject) => {
    marked.parse(md, (err, html) => {
      if (err) {
        reject();
      }
      resolve(html);
    });
  });
}

export function mdProcessor(md) {
  return md2html(md);
}
