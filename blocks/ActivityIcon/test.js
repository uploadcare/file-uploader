import { Icon } from '../Icon/Icon.js';
import { ActivityIcon } from './ActivityIcon.js';
import { registerBlocks } from '../registerBlocks.js';

registerBlocks({ Icon, ActivityIcon });

const actIcon = new ActivityIcon();
actIcon.classList.add('uc-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(actIcon);
  actIcon.$['*activityIcon'] = 'file';
};
