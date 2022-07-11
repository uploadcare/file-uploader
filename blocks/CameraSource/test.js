import { ifRef } from '../../utils/IfRef.js';
import { CameraSource } from './CameraSource.js';
import { Select } from '../Select/Select.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ CameraSource, Select, Icon });
  /** @type {CameraSource} */
  const cameraSrc = document.querySelector(CameraSource.is);
  cameraSrc.$['*currentActivity'] = 'camera';
});
