import { FileItem } from './FileItem.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../registerBlocks.js';

registerBlocks({ FileItem, Icon });

const fileItem = new FileItem();

fileItem.classList.add('uc-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(fileItem);
  let file = new File(['text'], 'test.txt', {
    type: 'plain/text',
  });
  fileItem.addFiles([file]);
  let fileId = fileItem.uploadCollection.items()[0];
  fileItem['entry-id'] = fileId;
  fileItem.render();
};
