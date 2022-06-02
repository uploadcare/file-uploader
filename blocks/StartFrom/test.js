import { StartFrom } from './StartFrom.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ StartFrom });

const startFrom = new StartFrom();
startFrom.classList.add('lr-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(startFrom);
};
