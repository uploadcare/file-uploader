import { ifRef } from '../../utils/ifRef.js';
import { DataOutput } from './DataOutput.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ DataOutput });
  /** @type {DataOutput} */
  let outEl = document.querySelector(DataOutput.is);
  outEl.$['*outputData'] = [{ uuid: Date.now() }, { uuid: Date.now() }, { uuid: Date.now() }];
});
