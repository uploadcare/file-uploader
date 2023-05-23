import { marked } from 'marked';
import hljs from 'highlight.js';
import { join } from 'path';
/**
 * @param {String} md
 * @param {Object} options
 * @param {String} options.base
 * @returns
 */
function md2html(md, { base }) {
  marked.setOptions({
    highlight: (code, lang, callback) => {
      if (lang) {
        // @ts-ignore
        code = hljs.highlight(code, { language: lang }).value;
      }
      callback && callback(undefined, code);
    },
    renderer: (() => {
      let renderer = new marked.Renderer();
      renderer.link = function (href, title, text) {
        if (href.startsWith('/')) {
          href = join(base, href);
        }
        let link = marked.Renderer.prototype.link.call(this, href, title, text);
        if (href.startsWith('http')) {
          return link.replace('<a', "<a target='_blank' ");
        }
        return link;
      };
      return renderer;
    })(),
  });

  return new Promise((resolve, reject) => {
    marked.parse(md, (err, html) => {
      if (err) {
        reject();
      }
      resolve(html);
    });
  });
}

export function mdProcessor(md, { base }) {
  return md2html(md, { base });
}
