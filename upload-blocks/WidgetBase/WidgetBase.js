import { SimpleBtn } from '../SimpleBtn/SimpleBtn.js';
import { AppComponent } from '../AppComponent/AppComponent.js';
import { SystemCall } from '../SystemCall/SystemCall.js';
import { DropArea } from '../DropArea/DropArea.js';
import { SourceBtn } from '../SourceBtn/SourceBtn.js';
import { FileItem } from '../FileItem/FileItem.js';
import { ModalWin } from '../ModalWin/ModalWin.js';
import { UploadList } from '../UploadList/UploadList.js';
import { ActivityMngr } from '../ActivityMngr/ActivityMngr.js';
import { UrlSource } from '../UrlSource/UrlSource.js';
import { CameraSource } from '../CameraSource/CameraSource.js';
import { PreEditor } from '../PreEditor/PreEditor.js';
import { MessageBox } from '../MessageBox/MessageBox.js';
import { UploadResult } from '../UploadResult/UploadResult.js';

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
PreEditor.reg('pre-editor');
MessageBox.reg('message-box');
UploadResult.reg('upload-result');

export class WidgetBase extends AppComponent {

  constructor() {
    super();
    this.pauseRender = true;
    this.renderShadow = true;
    this.initLocalState({
      'css-src': '',
      ctxName: this.ctxName,
    });
  }

  connectedCallback() {
    this.addToAppState({
      modalActive: false,
      modalCaption: 'Selected',
      files: [],
      results: [],
    });
    super.connectedCallback();
  }

  set 'css-src'(val) {
    if (!val) {
      return;
    }
    this.attachShadow({
      mode: 'open',
    });
    let link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = val;
    link.onload = () => {
      this.render();
    };
    this.shadowRoot.appendChild(link);
  }

}

WidgetBase.bindAttributes({
  'css-src': {
    prop: true,
  },
});
