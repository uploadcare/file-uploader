import fs from 'fs';
import { findFiles } from '@jam-do/jam-tools/node/index.js';
import { applyData, cssMin } from '@jam-do/jam-tools/iso/index.js';
import DOC_TPL from './tpl/main.tpl.js';
import DOC_CSS from './styles/css.js';
import { mdProcessor } from './mdProcessor.js';

let LIVE_HTML_CSS = fs.readFileSync('blocks/LiveHtml/live-html.css').toString();
let CODE_CSS = LIVE_HTML_CSS.replaceAll('lr-live-html [contenteditable]', 'code');
let IMPORTMAP = fs.readFileSync('static-gen/importmap.json').toString();

function getBase(path) {
  let slashes = path.split('/').length - 1;
  let base = '';
  for (let i = 0; i < slashes; i++) {
    base += '../';
  }
  return base || './';
}

/**
 * @param {String} inputName
 * @param {String} outputName
 * @param {(tpl: String, options: Object) => Promise<String>} [processor]
 */
function processEntries(inputName, outputName, processor) {
  let entries = findFiles('./', [inputName], ['node_modules']);
  entries.forEach(async (entryPath) => {
    let base = getBase(entryPath);
    let content = fs.readFileSync(entryPath).toString();
    let contentHtml = processor ? await processor(content, { base }) : content;
    let docCss = applyData(DOC_CSS, {
      BASE: base,
    });
    let output = applyData(DOC_TPL, {
      IMPORTMAP,
      CSS: cssMin(docCss + LIVE_HTML_CSS + CODE_CSS),
      BASE: base,
      CONTENT: contentHtml,
    });
    fs.writeFileSync(entryPath.replace(inputName, outputName), output);
  });
}

const allTasks = [
  {
    in: 'README.md',
    out: 'index.html',
    processor: mdProcessor,
  },
  {
    in: 'TOC.md',
    out: 'toc.html',
    processor: mdProcessor,
  },
  {
    in: 'ref.htm',
    out: 'index.html',
  },
];

allTasks.forEach((task) => {
  processEntries(task.in, task.out, task.processor);
});
