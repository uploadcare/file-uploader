import { ifRef } from '../../utils/ifRef.js';
import { ProgressBarCommon } from './ProgressBarCommon.js';
import { ProgressBar } from '../ProgressBar/ProgressBar.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ ProgressBarCommon, ProgressBar });
  /** @type {ProgressBarCommon} */
  let bar = document.querySelector(ProgressBarCommon.is);
  bar.$['visible'] = true;
  bar.$['*commonProgress'] = 55;
});
