import { WidgetBase } from '../WidgetBase/WidgetBase.js';
import { UploadData } from '../UploadData/UploadData.js';
import { SimpleBtn } from '../SimpleBtn/SimpleBtn.js';
import { SystemCall } from '../SystemCall/SystemCall.js';
import { DropArea } from '../DropArea/DropArea.js';
import { SourceBtn } from '../SourceBtn/SourceBtn.js';
import { FileItem } from '../FileItem/FileItem.js';
import { ModalWin } from '../ModalWin/ModalWin.js';
import { UploadList } from '../UploadList/UploadList.js';
import { ActivityMngr } from '../ActivityMngr/ActivityMngr.js';
import { UrlSource } from '../UrlSource/UrlSource.js';
import { CameraSource } from '../CameraSource/CameraSource.js';
import { UploadDetails } from '../UploadDetails/UploadDetails.js'
import { MessageBox } from '../MessageBox/MessageBox.js';
import { UploadResult } from '../UploadResult/UploadResult.js';
import { ConfirmationDialog } from '../ConfirmationDialog/ConfirmationDialog.js';
import { ProgressBar } from '../ProgressBar/ProgressBar.js'

UploadData.reg('upload-data');
SimpleBtn.reg('simple-btn');
ActivityMngr.reg('activity-mngr');
SystemCall.reg('system-call');
DropArea.reg('drop-area');
SourceBtn.reg('source-btn');
FileItem.reg('file-item');
ModalWin.reg('modal-win');
UploadList.reg('upload-list');
UrlSource.reg('url-source');
CameraSource.reg('camera-source');
UploadDetails.reg('upload-details');
MessageBox.reg('message-box');
UploadResult.reg('upload-result');
ConfirmationDialog.reg('confirmation-dialog');
ProgressBar.reg('progress-bar');

export class UploadWidget extends WidgetBase {}

UploadWidget.template = /*html*/ `
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
<message-box sub="@ctx-name: ctxName"><message-box>
`;
UploadWidget.reg('upload-widget');
