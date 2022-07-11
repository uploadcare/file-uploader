import { ifRef } from '../../utils/ifRef.js';
import { Icon } from './Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ Icon });
});
