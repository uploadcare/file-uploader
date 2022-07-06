import { ProgressBar } from './ProgressBar.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ ProgressBar });

const bar = new ProgressBar();
bar.classList.add('lr-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(bar);
  bar.style.height = '10px';
  // bar['value'] = 55;
  bar['visible'] = true;
  // bar['unknown'] = false;
};
