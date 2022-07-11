import { ifRef } from '../../utils/ifRef.js';
import { Range } from './Range.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ Range });
  /** @type {Range} */
  const range = document.querySelector(Range.is);
  range.$.caption = 'Range caption';
  range.$['*rangeValue'] = 30;
});
