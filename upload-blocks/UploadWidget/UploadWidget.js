import { WidgetBase } from '../WidgetBase/WidgetBase.js';

export class UploadWidget extends WidgetBase {}

const TPL1 = /*html*/ `
<drop-area sub="@ctx-name: ctxName">
  <source-btn type="local" sub="@ctx-name: ctxName"></source-btn>
  <source-btn type="url" sub="@ctx-name: ctxName"></source-btn>
  <source-btn type="camera" sub="@ctx-name: ctxName"></source-btn>
  <source-btn type="other" sub="@ctx-name: ctxName"></source-btn>
</drop-area>
<system-call sub="@ctx-name: ctxName"></system-call>
<modal-win sub="@ctx-name: ctxName">
  <activity-mngr sub="@ctx-name: ctxName">
    <upload-list activity="upload-list" sub="@ctx-name: ctxName"></upload-list>
    <camera-source activity="camera" sub="@ctx-name: ctxName"></camera-source>
    <url-source activity="url" sub="@ctx-name: ctxName"></url-source>
    <external-source activity="external" sub="@ctx-name: ctxName"></external-source>
    <pre-editor activity="pre-edit" sub="@ctx-name: ctxName"></pre-editor>
  </activity-mngr>
</modal-win>
<upload-result sub="@ctx-name: ctxName"></upload-result>
`;

const TPL2 = /*html*/ `
<simple-btn sub="@ctx-name: ctxName"></simple-btn>
<system-call sub="@ctx-name: ctxName"></system-call>
<modal-win sub="@ctx-name: ctxName">
  <activity-mngr sub="@ctx-name: ctxName">
    <drop-area activity="source-select" sub="@ctx-name: ctxName">
      <source-btn type="local" sub="@ctx-name: ctxName"></source-btn>
      <source-btn type="url" sub="@ctx-name: ctxName"></source-btn>
      <source-btn type="camera" sub="@ctx-name: ctxName"></source-btn>
      <source-btn type="other" sub="@ctx-name: ctxName"></source-btn>
    </drop-area>
    <upload-list activity="upload-list" sub="@ctx-name: ctxName"></upload-list>
    <camera-source activity="camera" sub="@ctx-name: ctxName"></camera-source>
    <url-source activity="url" sub="@ctx-name: ctxName"></url-source>
    <external-source activity="external" sub="@ctx-name: ctxName"></external-source>
    <pre-editor activity="pre-edit" sub="@ctx-name: ctxName"></pre-editor>
    <upload-result activity="result" sub="@ctx-name: ctxName"></upload-result>
  </activity-mngr>
</modal-win>
`;

UploadWidget.template = TPL1;
UploadWidget.reg();