import { UploadDetails } from '../UploadDetails.js';
import { IconUi } from '../../IconUi/IconUi.js';
import { EditableCanvas } from '../../EditableCanvas/EditableCanvas.js';

IconUi.reg('uc-icon-ui');
UploadDetails.reg('upload-details');
EditableCanvas.reg('editable-canvas');

window.onload = () => {
  /** @type {UploadDetails} */
  let details = document.querySelector(UploadDetails.is);
  let file = new File(['test'], 'test', {
    lastModified: Date.now(),
    type: 'image/png',
  });
  let entry = details.uploadCollection.add({
    file,
    fileName: file.name,
    fileSize: file.size,
    isImage: true,
    mimeType: file.type,
  });
  details.pub('external', 'focusedEntry', entry);
  console.log(details);
};
