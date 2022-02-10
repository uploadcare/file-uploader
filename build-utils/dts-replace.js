import fs from 'fs';

const DEFAULT_CFG_PATH = './dts.cfg.json';
let cfg_path;
let args = process.argv;
args.forEach((kvStr) => {
  if (kvStr.includes('-cfg=')) {
    cfg_path = kvStr.split('=')[1].trim();
  }
});

let cfg = JSON.parse(fs.readFileSync(cfg_path || DEFAULT_CFG_PATH).toString());
if (!cfg) {
  console.log('dts-replace: configuration not found...');
  process.abort();
}
cfg.entries.forEach((ent) => {
  let outFile = fs.readFileSync(ent.outFile).toString();
  // TODO: make more universal replacement
  let result = outFile.replaceAll('../../node_modules/@symbiotejs/symbiote/build/symbiote.js', '@symbiotejs/symbiote');
  fs.writeFileSync(ent.outFile, result);
});
