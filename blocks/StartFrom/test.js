import { ifRef } from '../../utils/ifRef.js';
import { StartFrom } from './StartFrom.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ StartFrom });
});
