import { UploadDetails } from './UploadDetails.js';
import { Icon } from '../Icon/Icon.js';
import { Tabs } from '../Tabs/Tabs.js';
import { EditableCanvas } from '../EditableCanvas/EditableCanvas.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ UploadDetails, Icon, Tabs, EditableCanvas });

const uploadDetails = new UploadDetails();
uploadDetails.classList.add('lr-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(uploadDetails);
  uploadDetails.$['*currentActivity'] = 'details';
};
