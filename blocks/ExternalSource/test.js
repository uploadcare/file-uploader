import { ifRef } from '../../utils/ifRef.js';
import { ExternalSource } from './ExternalSource.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ Icon, ExternalSource });
  /** @type {ExternalSource} */
  const extSrc = document.querySelector(ExternalSource.is);
  extSrc.$['*currentActivity'] = 'external';
});
