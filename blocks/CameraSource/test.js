import { CameraSource } from './CameraSource.js';
import { Select } from '../Select/Select.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

window.onload = () => {
  if (window.location.host) {
    return;
  }
  registerBlocks({ CameraSource, Select, Icon });
  /** @type {CameraSource} */
  const cameraSrc = document.querySelector('lr-camera-source');
  cameraSrc.$['*currentActivity'] = 'camera';
};
