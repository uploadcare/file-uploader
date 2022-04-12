import { CameraSource } from './CameraSource.js';
import { registerBlocks } from '../registerBlocks.js';

registerBlocks({ CameraSource });

const cameraSrc = new CameraSource();
cameraSrc.classList.add('uc-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(cameraSrc);
  cameraSrc.$['*currentActivity'] = 'camera';
};
