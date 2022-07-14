import { ifRef } from '../../utils/ifRef.js';
import { DropArea } from './DropArea.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ DropArea });
});
