import * as UC from './exports.js';
import { registerBlocks } from './registerBlocks.js';

if (typeof window !== 'undefined') {
  // TODO: should we register components automatically?
  registerBlocks(UC);
}

export { UC };
