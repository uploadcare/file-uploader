import { WidgetBase } from '../WidgetBase/WidgetBase.js';
import { IconUi } from '../IconUi/IconUi.js';
import { SimpleBtn } from '../SimpleBtn/SimpleBtn.js';
import { DropArea } from '../DropArea/DropArea.js';
import { SourceBtn } from '../SourceBtn/SourceBtn.js';
import { FileItem } from '../FileItem/FileItem.js';
import { ModalWin } from '../ModalWin/ModalWin.js';
import { UploadList } from '../UploadList/UploadList.js';
import { UrlSource } from '../UrlSource/UrlSource.js';
import { CameraSource } from '../CameraSource/CameraSource.js';
import { UploadDetails } from '../UploadDetails/UploadDetails.js';
import { MessageBox } from '../MessageBox/MessageBox.js';
import { UploadResult } from '../UploadResult/UploadResult.js';
import { ConfirmationDialog } from '../ConfirmationDialog/ConfirmationDialog.js';
import { ProgressBar } from '../ProgressBar/ProgressBar.js';
import { EditableCanvas } from '../EditableCanvas/EditableCanvas.js';
import { CloudImageEditor } from '../CloudImageEditor/CloudImageEditor.js';
import { ExternalSource } from '../ExternalSource/ExternalSource.js';

// IconUi - is extended from BaseComponent
IconUi.reg('uc-icon-ui');

// Other components are extended from BlockComponent:
SimpleBtn.reg('simple-btn');
DropArea.reg('drop-area');
SourceBtn.reg('source-btn');
FileItem.reg('file-item');
ModalWin.reg('modal-win');
UploadList.reg('upload-list');

// File sources:
UrlSource.reg('url-source');
CameraSource.reg('camera-source');
ExternalSource.reg('external-source');

UploadDetails.reg('upload-details');
MessageBox.reg('message-box');
UploadResult.reg('upload-result');
ConfirmationDialog.reg('confirmation-dialog');
ProgressBar.reg('progress-bar');
EditableCanvas.reg('editable-canvas');
CloudImageEditor.reg('cloud-image-editor');

export class UploadWidget extends WidgetBase {}

UploadWidget.template = /*html*/ `
<uc-drop-area>
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
<uc-system-call></uc-system-call>
<uc-modal-win>
<uc-activity-mngr>
    <uc-upload-list activity="upload-list"></uc-upload-list>
    <uc-camera-source activity="camera"></uc-camera-source>
    <uc-url-source activity="url"></uc-url-source>
    <uc-pre-editor activity="pre-edit"></uc-pre-editor>
    <uc-cloud-image-editor activity="cloud-image-edit"></uc-cloud-image-editor>
    <uc-external-source activity="external"></uc-external-source>
  </uc-activity-mngr>
</uc-modal-win>
<uc-upload-result></uc-upload-result>
<uc-message-box><uc-message-box>
`;
UploadWidget.reg('upload-widget');
