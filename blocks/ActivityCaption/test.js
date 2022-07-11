import { ifRef } from '../../utils/ifRef.js';
import { ActivityCaption } from './ActivityCaption.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ ActivityCaption });
  /** @type {ActivityCaption} */
  let actCap = document.querySelector(ActivityCaption.is);
  actCap.$['*activityCaption'] = 'TEST CAPTION';
});
