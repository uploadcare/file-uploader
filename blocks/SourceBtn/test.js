import { ifRef } from '../../utils/ifRef.js';
import { SourceBtn } from './SourceBtn.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ SourceBtn, Icon });
});
