import { ExternalSource } from './ExternalSource.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

window.onload = () => {
  if (window.location.host) {
    return;
  }
  registerBlocks({ Icon, ExternalSource });
  const extSrc = new ExternalSource();
  extSrc.classList.add('lr-wgt-common');
  document.querySelector('#viewport')?.appendChild(extSrc);
  extSrc.$['*currentActivity'] = 'external';
};
