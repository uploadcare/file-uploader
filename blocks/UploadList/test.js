import { ifRef } from '../../utils/ifRef.js';
import { UploadList } from './UploadList.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ UploadList });
  /** @type {UploadList} */
  let uploadList = document.querySelector(UploadList.is);
  uploadList.$['*currentActivity'] = 'upload-list';
});
