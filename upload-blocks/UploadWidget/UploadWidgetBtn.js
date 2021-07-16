import { WidgetBase } from '../WidgetBase/WidgetBase.js';

export class UploadWidget extends WidgetBase {}

export class UploadWidgetBtn extends WidgetBase {}
UploadWidgetBtn.template = /*html*/ `
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
    <uploads-list  activity="uploads-list" sub="@ctx-name: ctxName"></uploads-list>
  </activity-mngr>
</modal-win>
<message-box sub="@ctx-name: ctxName"><message-box>
`;
UploadWidgetBtn.reg('upload-widget-btn');