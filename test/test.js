import puppeteer from 'puppeteer';
import { findFiles } from '@jam-do/jam-tools/node/findFiles.js';
import D from './decorations.js';

let allRefs = findFiles('./', ['index.html'], ['node_modules', 'TMP']);

let errors = 0;
let warnings = 0;

const browser = await puppeteer.launch();
const page = await browser.newPage();
page.on('error', (err) => {
  console.log(D.fg.red, err.message);
  errors++;
});
page.on('pageerror', (err) => {
  console.log(D.fg.red, err.message);
  errors++;
});
page.on('console', (msg) => {
  console.log(D.fg.yellow, msg.text());
  warnings++;
});

for (let i = 0; i < allRefs.length; i++) {
  let refPath = allRefs[i];
  console.log(D.fg.white, `Testing: ${refPath}`);
  page.goto('http://localhost:8000/' + refPath);
  await page.waitForNetworkIdle();
  await page.waitForTimeout(200);
  console.log(D.fg.blue, `${i + 1} done...`);
}

console.log(D.bg.white, D.fg.blue, 'Result:');
console.log(D.fg.blue, `${allRefs.length} entries tested.`);
console.log(D.fg.red, `${errors} errors`);
console.log(D.fg.yellow, `${warnings} warnings`);
process.exit();
