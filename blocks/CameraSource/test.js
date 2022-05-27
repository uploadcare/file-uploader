import { CameraSource } from './CameraSource.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ CameraSource });

const cameraSrc = new CameraSource();
cameraSrc.classList.add('lr-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(cameraSrc);
  cameraSrc.$['*currentActivity'] = 'camera';
};
