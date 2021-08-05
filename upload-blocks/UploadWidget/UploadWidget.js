import { WidgetBase } from '../WidgetBase/WidgetBase.js';
import { IconUi } from '../IconUi/IconUi.js';
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

IconUi.reg('icon-ui');
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
<drop-area>
  <source-btn type="local"></source-btn>
  <source-btn type="url"></source-btn>
  <source-btn type="camera"></source-btn>
  <source-btn type="other"></source-btn>
</drop-area>
<system-call></system-call>
<modal-win>
  <activity-mngr>
    <upload-list activity="upload-list"></upload-list>
    <camera-source activity="camera"></camera-source>
    <url-source activity="url"></url-source>
    <external-source activity="external"></external-source>
    <pre-editor activity="pre-edit"></pre-editor>
  </activity-mngr>
</modal-win>
<upload-result></upload-result>
<message-box><message-box>
`;
UploadWidget.reg('upload-widget');
