import { DataOutput } from './DataOutput.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ DataOutput });

window.onload = () => {
  let outEl = document.querySelector('lr-data-output');
  if (outEl) {
    outEl.$['*outputData'] = [{ uuid: Date.now() }, { uuid: Date.now() }, { uuid: Date.now() }];
  }
};
