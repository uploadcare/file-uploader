import { ActivityComponent } from './ActivityComponent/ActivityComponent.js';
import { BaseComponent } from '../symbiote/core/BaseComponent.js';

import { Icon } from './Icon/Icon.js';
import { SimpleBtn } from './SimpleBtn/SimpleBtn.js';
import { ActivityWrapper } from './ActivityWrapper/ActivityWrapper.js';
import { DropArea } from './DropArea/DropArea.js';
import { SourceBtn } from './SourceBtn/SourceBtn.js';
import { SourceList } from './SourceList/SourceList.js';
import { FileItem } from './FileItem/FileItem.js';
import { Modal } from './Modal/Modal.js';
import { UploadList } from './UploadList/UploadList.js';
import { UrlSource } from './UrlSource/UrlSource.js';
import { CameraSource } from './CameraSource/CameraSource.js';
import { UploadDetails } from './UploadDetails/UploadDetails.js';
import { MessageBox } from './MessageBox/MessageBox.js';
import { ConfirmationDialog } from './ConfirmationDialog/ConfirmationDialog.js';
import { ProgressBar } from './ProgressBar/ProgressBar.js';
import { EditableCanvas } from './EditableCanvas/EditableCanvas.js';
import { CloudImageEditor } from './CloudImageEditor/CloudImageEditor.js';
import { ExternalSource } from './ExternalSource/ExternalSource.js';
import { Tabs } from './Tabs/Tabs.js';
import { DataOutput } from './DataOutput/DataOutput.js';

export { UploadWidget } from './UploadWidget/UploadWidget.js';

export {
  ActivityComponent,
  BaseComponent,
  Icon,
  SimpleBtn,
  ActivityWrapper,
  DropArea,
  SourceBtn,
  SourceList,
  FileItem,
  Modal,
  UploadList,
  UrlSource,
  CameraSource,
  UploadDetails,
  MessageBox,
  ConfirmationDialog,
  ProgressBar,
  EditableCanvas,
  CloudImageEditor,
  ExternalSource,
  Tabs,
  DataOutput,
};

export function register() {
  // Icon - is extended from BaseComponent
  Icon.reg('uc-icon');

  // Other components are extended from BlockComponent:
  SimpleBtn.reg('simple-btn');
  ActivityWrapper.reg('activity-wrapper');
  DropArea.reg('drop-area');
  SourceBtn.reg('source-btn');
  SourceList.reg('source-list');
  FileItem.reg('file-item');
  Modal.reg('modal');
  UploadList.reg('upload-list');

  // File sources:
  UrlSource.reg('url-source');
  CameraSource.reg('camera-source');
  ExternalSource.reg('external-source');

  UploadDetails.reg('upload-details');
  MessageBox.reg('message-box');
  ConfirmationDialog.reg('confirmation-dialog');
  ProgressBar.reg('progress-bar');
  EditableCanvas.reg('editable-canvas');
  CloudImageEditor.reg('cloud-image-editor');
  DataOutput.reg('data-output');

  Tabs.reg('tabs');
}

if (typeof window !== 'undefined') {
  register();
}
