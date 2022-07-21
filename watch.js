import watch from 'node-watch';
import { execSync } from 'child_process';
import { debounce } from './blocks/utils/debounce';

let onChange = debounce((type, filepath) => {
  console.log(type, filepath);
  execSync('node --experimental-fetch ./static-gen/build.js');
}, 100);

let watcher = watch(
  './',
  { recursive: true, filter: (f) => !/node_modules/.test(f) && !/\.html$/.test(f) && !/^\./.test(f) },
  /** @type {(eventType: 'update' | 'remove', filePath: string) => any} */ (onChange)
);

process.on('SIGINT', () => {
  watcher.close();
  process.exit(0);
});
