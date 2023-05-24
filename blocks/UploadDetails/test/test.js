import { UploadDetails } from '../UploadDetails.js';
import { Icon } from '../../Icon/Icon.js';
import { EditableCanvas } from '../../EditableCanvas/EditableCanvas.js';
import { Tabs } from '../../Tabs/Tabs.js';

Icon.reg('lr-icon');
UploadDetails.reg('upload-details');
EditableCanvas.reg('editable-canvas');
Tabs.reg('tabs');

window.onload = () => {
  /** @type {UploadDetails} */
  let details = document.querySelector(UploadDetails.is);
  details.$['*currentActivity'] = UploadDetails.activities.DETAILS;
  window.fetch('./test.png').then(async (resp) => {
    let blob = await resp.blob();
    let file = new File([blob], 'test', {
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
    details.$['*focusedEntry'] = entry;
    console.log(details);
  });
};
