import { FileItem } from './FileItem.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

window.onload = () => {
  if (window.location.host) {
    return;
  }
  registerBlocks({ FileItem, Icon });
  const fileItem = new FileItem();
  fileItem.classList.add('lr-wgt-common');
  document.querySelector('#viewport')?.appendChild(fileItem);
  fileItem.render();
  let file = new File(['text'], 'test.txt', {
    type: 'plain/text',
  });
  fileItem.addFiles([file]);
  let fileId = fileItem.uploadCollection.items()[0];
  fileItem.$.uid = fileId;
};
