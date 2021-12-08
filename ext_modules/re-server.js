import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';

const MIME_MAP = {
  '.ico': 'image/x-icon',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.zip': 'application/zip',
};

function getCfg() {
  return JSON.parse(fs.readFileSync('project.json').toString());
}
 
const TMP_NAME = 're4ma.tmp.json';

export class ReServer {

  constructor() {
    this._server = http.createServer((request, response) => {
      if (request.method === 'POST') {
        let data = [];
        request.on('data', (chunk) => {
          data.push(chunk);
        });
        request.on('end', () => {
          let reCall =  JSON.parse(data.join(''));
          if (reCall.type === 'link') {
            let tmp = {};
            if (fs.existsSync(TMP_NAME)) {
              tmp = JSON.parse(fs.readFileSync(TMP_NAME).toString());
            }
            if (!tmp.links) {
              tmp.links = [];
            }
            if (!tmp.links.includes(reCall.href)) {
              tmp.links.push(reCall.href);
              console.log('Link added: ' + reCall.href);
            }
            fs.writeFileSync(TMP_NAME, JSON.stringify(tmp, undefined, 2));
          } else if (reCall.type === 'save') {
            /** @type {String} */
            let outDir = this.cfg.output;
            /** @type {String} */
            let path = reCall.path;
            if (!outDir.endsWith('/')) {
              outDir += '/';
            }
            if (path.startsWith('/')) {
              path = path.replace('/', '');
            }
            let filePath = outDir + reCall.path;
            if (!filePath.includes('.htm')) {
              filePath += 'index.html';
            }
            if (filePath.includes('//')) {
              // @ts-ignore
              filePath = filePath.replaceAll('//', '/');
            }
            let dirPathArr = filePath.split('/');
            dirPathArr.pop();
            let dirPath = dirPathArr.join('/');
            if (!fs.existsSync(dirPath)) {
              fs.mkdirSync(dirPath, {
                recursive: true,
              });
            }
            fs.writeFileSync(filePath, reCall.html);
            console.log('Saved: ' + filePath);
          }
        });
        response.statusCode = 200;
        response.end();
        return;
      }
      let parsedUrl = url.parse(request.url);
      let filePath = '.' + parsedUrl.pathname;
      let fileExt = path.parse(filePath).ext;
      fs.stat(filePath, {bigint: false}, (err, stat) => {
        if (err) {
          response.statusCode = 404;
          response.end('File not found: ' + filePath);
          return;
        } 
        if (fs.statSync(filePath).isDirectory()) {
          filePath += 'index.html';
          fileExt = '.html';
        }
      
        fs.readFile(filePath, {}, (err, /** @type {Buffer | String} */ data) => {
          if (err) {
            console.log(filePath);
            response.statusCode = 500;
            response.end('Internal Server Error');
            return;
          }
          response.setHeader('Content-type', MIME_MAP[fileExt] || 'text/plain');
          response.end(data);
        });
      });
    });
  }

  start() {
    this.cfg = getCfg();
    console.log(this.cfg);
    this.port = this.cfg.localPort || 9000;
    this._server.listen(this.port);
    console.log(`http://localhost:${this.port}/`);
  }

  stop() {
    this._server.close((err) => {
      console.log(err);
    });
  }

}

const devServer = new ReServer();
devServer.start();