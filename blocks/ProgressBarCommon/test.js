import { ProgressBarCommon } from './ProgressBarCommon.js';
import { ProgressBar } from '../ProgressBar/ProgressBar.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ ProgressBarCommon, ProgressBar });

const bar = new ProgressBarCommon();
bar.classList.add('lr-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(bar);
  // bar.$['unknown'] = false;
  bar.$['visible'] = true;
  bar.$['*commonProgress'] = 55;
};
