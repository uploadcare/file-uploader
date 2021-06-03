import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { exec } from 'child_process';

const VIEW_PATH = './view/';
const LOG_URL = 'https://uc-uploader-next.web.app/log.json';
const BUILD_DIR_PATH = './dist/';

const GIT_SUMMARY_CMD = 'git show --summary';
const FIREBASE_DEPLOY_CMD = 'firebase deploy';

function getParamValue(name) {
  return process.argv[process.argv.indexOf(name) + 1];
}

const IS_STABLE = process.argv.includes('--stable');
const STORE = process.argv.includes('--store');
const MSG = getParamValue('--msg');
const PUBKEY = getParamValue('--pubkey') || 'demopublickey';

console.log({
  stable: IS_STABLE,
  store: STORE,
  message: MSG,
  pubkey: PUBKEY,
});

/**
 * @param {String} cmdStr
 * @returns {any}
 */
function runCmd(cmdStr) {
  return new Promise((resolve, reject) => {
    exec(cmdStr, (error, stdout, stderr) => {
      if (error) {
        reject(error.message);
      }
      if (stderr) {
        reject(stderr);
      }
      resolve(stdout);
    });
  });
}

/**
 * @param {Buffer} fileData
 * @param {Object} [opt] Upload options
 * @param {String} [opt.pubkey]
 * @param {String} [opt.name]
 * @param {Boolean} [opt.store]
 * @param {String} [opt.type]
 * @returns {Promise<{ file: string }>}
 */
function upload(fileData, opt = {}) {
  let formData = new FormData();
  formData.append('UPLOADCARE_PUB_KEY', opt.pubkey || 'demopublickey');
  opt.store && formData.append('UPLOADCARE_STORE', 1);
  formData.append('file', fileData, {
    filename: opt.name || 'file',
    contentType: opt.type || 'application/octet-stream',
  });
  return new Promise((resolve, reject) => {
    fetch('https://upload.uploadcare.com/base/', {
      method: 'POST',
      headers: formData.getHeaders(),
      body: formData,
    })
      .then(async (resp) => {
        let txt = await resp.text();
        try {
          resolve(JSON.parse(txt));
        } catch (e) {
          console.log(e);
          reject(txt);
        }
      })
      .catch((err) => {
        reject(err);
      });
  });
}

let filesMap = {};

/** @enum {string} */
const MIME = {
  html: 'text/html',
  js: 'text/javascript',
  json: 'application/json',
  css: 'text/css',
  png: 'image/png',
};

/**
 * @param {String} dir
 * @param {String} pathSplitter
 */
async function uploadFilesFrom(dir, pathSplitter) {
  let fsEntries = fs.readdirSync(dir, {
    withFileTypes: true,
  });
  for (let fse of fsEntries) {
    let fPath = path.join(dir, fse.name);
    if (fse.isDirectory()) {
      await uploadFilesFrom(fPath, pathSplitter);
    } else {
      let file = fs.readFileSync(fPath);
      let cdnFileInfo = await upload(file, {
        pubkey: PUBKEY,
        name: fse.name,
        store: STORE,
        type: MIME[fse.name.split('.').pop()],
      });
      filesMap[fPath.split(pathSplitter)[1]] = `https://ucarecdn.com/${cdnFileInfo.file}/`;
    }
  }
}

async function deployToCdn() {
  console.log('Uploading...');
  let log = await (await fetch(LOG_URL)).json();
  await uploadFilesFrom(BUILD_DIR_PATH, 'dist/');
  console.log(filesMap);
  let date = new Date(Date.now()).toUTCString();
  filesMap.__META__ = {
    date,
    isStable: IS_STABLE,
    message: MSG,
    gitSummary: (await runCmd(GIT_SUMMARY_CMD)).split('\n').map((str) => str.trim()),
  };
  let depl = await upload(Buffer.from(JSON.stringify(filesMap)), {
    pubkey: PUBKEY,
    name: 'deployment.json',
    store: STORE,
    type: MIME.json,
  });
  console.log('Deployment ID: ' + depl.file);
  log[depl.file] = filesMap;
  fs.writeFileSync(VIEW_PATH + 'log.json', JSON.stringify(log, undefined, 2));
  console.log('Updating log...');
  await runCmd(FIREBASE_DEPLOY_CMD);
  console.log(`https://uc-uploader-next.web.app/?uuid=${depl.file}`);
}

deployToCdn();