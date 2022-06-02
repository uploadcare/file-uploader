import { Range } from './Range.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ Range });

const range = new Range();
range.classList.add('lr-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(range);
  range.$.caption = 'My range caption';
  range.$['*rangeValue'] = 30;
};
