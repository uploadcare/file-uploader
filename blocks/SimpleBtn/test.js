import { ifRef } from '../../utils/ifRef.js';
import { SimpleBtn } from './SimpleBtn.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ SimpleBtn, Icon });
});
