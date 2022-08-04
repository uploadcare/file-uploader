import { ifRef } from '../../utils/ifRef.js';
import { UploadDetails } from './UploadDetails.js';
import { Icon } from '../Icon/Icon.js';
import { Tabs } from '../Tabs/Tabs.js';
import { EditableCanvas } from '../EditableCanvas/EditableCanvas.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ UploadDetails, Icon, Tabs, EditableCanvas });
  /** @type {UploadDetails} */
  let uploadDetails = document.querySelector(UploadDetails.is);
  uploadDetails.$['*currentActivity'] = 'details';
});
