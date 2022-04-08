import { ActivityCaption } from './ActivityCaption.js';
import { registerBlocks } from '../registerBlocks.js';

registerBlocks({ ActivityCaption });

const actCap = new ActivityCaption();
actCap.classList.add('uc-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(actCap);
  actCap.$['*activityCaption'] = 'TEST CAPTION';
};
