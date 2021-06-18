import { Server } from './server.js';
import child from 'child_process';

const port = 8000;
const server = new Server(port);
server.start();
let url = 'http://localhost:' + port;
console.log('Server started at ' + url);
let cmd = process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open';
child.exec(`${cmd} ${url}`);
