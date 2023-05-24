import { ifRef } from '../../utils/ifRef.js';
import { FileItem } from './FileItem.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ FileItem, Icon });
  /** @type {FileItem} */
  const fileItem = document.querySelector(FileItem.is);
  let file = new File(['text'], 'test.txt', {
    type: 'plain/text',
  });
  fileItem.addFiles([file]);
  let fileId = fileItem.uploadCollection.items()[0];
  fileItem.$.uid = fileId;
});
