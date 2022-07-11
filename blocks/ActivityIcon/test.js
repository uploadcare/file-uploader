import { ifRef } from '../../utils/ifRef.js';
import { Icon } from '../Icon/Icon.js';
import { ActivityIcon } from './ActivityIcon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ Icon, ActivityIcon });
  /** @type {ActivityIcon} */
  let actIcon = document.querySelector(ActivityIcon.is);
  actIcon.$['*activityIcon'] = 'file';
});
