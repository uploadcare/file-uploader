import { ExternalSource } from './ExternalSource.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../registerBlocks.js';

registerBlocks({ Icon, ExternalSource });

const extSrc = new ExternalSource();
extSrc.classList.add('uc-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(extSrc);
  extSrc.$['*currentActivity'] = 'external';
};
