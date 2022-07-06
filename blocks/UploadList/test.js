import { UploadList } from './UploadList.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ UploadList });

const uploadList = new UploadList();
uploadList.classList.add('lr-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(uploadList);
  uploadList.$['*currentActivity'] = 'upload-list';
};
