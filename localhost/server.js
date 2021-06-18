import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import child from 'child_process';

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

export class Server {
  /**
   * @param {Number} port
   * @param {(data: Buffer | String) => String | Promise<String>} [cb] Data handler
   */
  constructor(port = 9000, cb) {
    this.port = port;
    this._server = http.createServer((request, response) => {
      let parsedUrl = url.parse(request.url);
      let filePath = '.' + parsedUrl.pathname;
      let fileExt = path.parse(filePath).ext;
      fs.stat(filePath, { bigint: false }, (err, stat) => {
        if (err) {
          response.statusCode = 404;
          response.end('File not found: ' + filePath);
          return;
        }
        if (fs.statSync(filePath).isDirectory()) {
          filePath += 'index.html';
          fileExt = '.html';
        }
        if (filePath)
          fs.readFile(filePath, {}, async (err, /** @type {Buffer | String} */ data) => {
            if (err) {
              console.log(filePath);
              response.statusCode = 500;
              response.end('Internal Server Error');
              return;
            }
            response.setHeader('Content-type', MIME_MAP[fileExt] || 'text/plain');
            response.end(cb ? await cb(data) : data);
          });
      });
    });
  }

  start() {
    this._server.listen(this.port);
  }

  stop() {
    this._server.close((err) => {
      console.log(err);
    });
  }
}
