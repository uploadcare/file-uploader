import { UploadWidget } from './UploadWidget.js';
import { ACT } from '../dictionary.js';

export class UploadWidgetBtn extends UploadWidget {}
UploadWidgetBtn.template = /*html*/ `
<uc-simple-btn></uc-simple-btn>
<uc-modal-win>
  <uc-activity-mngr>
    <uc-drop-area activity="${ACT.SOURCE_SELECT}">
      <uc-source-btn type="local"></uc-source-btn>
      <uc-source-btn type="url"></uc-source-btn>
      <uc-source-btn type="camera"></uc-source-btn>
      <uc-source-btn type="facebook"></uc-source-btn>
      <uc-source-btn type="dropbox"></uc-source-btn>
      <uc-source-btn type="gdrive"></uc-source-btn>
      <uc-source-btn type="gphotos"></uc-source-btn>
      <uc-source-btn type="instagram"></uc-source-btn>
      <uc-source-btn type="flickr"></uc-source-btn>
      <uc-source-btn type="vk"></uc-source-btn>
      <uc-source-btn type="evernote"></uc-source-btn>
      <uc-source-btn type="box"></uc-source-btn>
      <uc-source-btn type="onedrive"></uc-source-btn>
      <uc-source-btn type="huddle"></uc-source-btn>
      <uc-source-btn type="other"></uc-source-btn>
    </uc-drop-area>
    <uc-upload-list activity="${ACT.UPLOAD_LIST}"></uc-upload-list>
    <uc-camera-source activity="${ACT.CAMERA}"></uc-camera-source>
    <uc-url-source activity="${ACT.URL}"></uc-url-source>
    <uc-upload-details activity="${ACT.UPLOAD_DETAILS}"></uc-upload-details>
    <uc-confirmation-dialog activity="${ACT.COMFIRMATION}"></uc-confirmation-dialog>
    <uc-cloud-image-editor activity="${ACT.CLOUD_IMAGE_EDIT}"></uc-cloud-image-editor>
    <uc-external-source activity="${ACT.EXTERNAL_SOURCE}"></uc-external-source>
  </uc-activity-mngr>
</uc-modal-win>
<uc-message-box></uc-message-box>
<uc-progress-bar></uc-progress-bar>
`;
UploadWidgetBtn.reg('upload-widget-btn');
