import { ifRef } from '../../utils/ifRef.js';
import { Video } from './Video.js';
import { Icon } from '../Icon/Icon.js';
import { Range } from '../Range/Range.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ Video, Icon, Range });
});
