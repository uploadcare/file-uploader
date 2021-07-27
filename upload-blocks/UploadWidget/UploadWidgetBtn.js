import { UploadWidget } from './UploadWidget.js';

export class UploadWidgetBtn extends UploadWidget {}
UploadWidgetBtn.template = /*html*/ `
<upload-data></upload-data>
<simple-btn></simple-btn>
<system-call></system-call>
<modal-win>
  <activity-mngr>
    <drop-area activity="source-select">
      <source-btn type="local"></source-btn>
      <source-btn type="url"></source-btn>
      <source-btn type="camera"></source-btn>
      <source-btn type="other"></source-btn>
    </drop-area>
    <upload-list activity="upload-list"></upload-list>
    <camera-source activity="camera"></camera-source>
    <url-source activity="url"></url-source>
    <external-source activity="external"></external-source>
    <upload-details activity="pre-edit"></upload-details>
    <confirmation-dialog activity="confirmation"></confirmation-dialog>
  </activity-mngr>
</modal-win>
<message-box></message-box>
<progress-bar></progress-bar>
`;
UploadWidgetBtn.reg('upload-widget-btn');