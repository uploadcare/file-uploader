import { ifRef } from '../../utils/ifRef.js';
import { ProgressBar } from './ProgressBar.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ ProgressBar });
  /** @type {ProgressBar} */
  let bar = document.querySelector(ProgressBar.is);
  bar.style.height = '10px';
  bar['visible'] = true;
});
