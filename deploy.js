import { deployToCdn } from './deploy-to-cdn/index.js';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const getPackageVersion = (packageName) => JSON.parse(readFileSync(`./${packageName}/package.json`).toString()).version;

const doDeploy = (packageName) => {
  deployToCdn({
    name: packageName,
    version: getPackageVersion(packageName),
    input: resolve(`./build/${packageName}`),
    dry: true,
  });
};

doDeploy('upload-blocks');
doDeploy('symbiote');
