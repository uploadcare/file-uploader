import { ifRef } from '../../utils/ifRef.js';
import { Tabs } from './Tabs.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ Tabs });
});
