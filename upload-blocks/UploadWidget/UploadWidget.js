import { AppComponent } from '../AppComponent/AppComponent.js';
import { ShadowWrapper } from '../../shadow-wrapper-element/ShadowWrapper.js';
import { SystemCall } from '../SystemCall/SystemCall.js';
import { DropArea } from '../DropArea/DropArea.js';
import { SourceBtn } from '../SourceBtn/SourceBtn.js';
import { SourceSelect } from '../SourceSelect/SourceSelect.js';
import { FileItem } from '../FileItem/FileItem.js';
import { ModalWin } from '../ModalWin/ModalWin.js';
import { UploadList } from '../UploadList/UploadList.js';

window.customElements.define('shadow-wrapper', ShadowWrapper);

SystemCall.reg();
DropArea.reg();
SourceBtn.reg();
SourceSelect.reg();
FileItem.reg();
ModalWin.reg();
UploadList.reg();

const ICONS = {

};

export class UploadWidget extends AppComponent {

  constructor() {
    super();
    this.initLocalState({
      cssSrc: './test.css',
      ctxName: 'upload-widget',

      'on.local': () => {
        this.appState.pub('systemTrigger', {});
      },
      'on.url': () => {
        this.appState.pub('modalActive', true);
        this.appState.pub('modalCaption', 'Import from external URL');
      },
      'on.camera': () => {
        this.appState.pub('modalActive', true);
        this.appState.pub('modalCaption', 'Camera');
      },
      'on.more': () => {
        this.appState.pub('modalActive', true);
        this.appState.pub('modalCaption', 'Other sources');
      },
    });
    this.addToAppState({
      modalActive: false,
      modalCaption: 'Selected',
      files: [],
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this.localState.pub('ctxName', this.ctxName);
  }

}

UploadWidget.template = /*html*/ `
<shadow-wrapper sub="@css-src: cssSrc">
  <drop-area ctx-name="uploader">
    <source-btn text="Local Files" icon="local" type="local" sub="onclick: on.local"></source-btn>
    <source-btn text="From URL" icon="url" type="url" sub="onclick: on.url"></source-btn>
    <source-btn text="Camera" icon="camera" type="camera" sub="onclick: on.camera"></source-btn>
    <source-btn text="" icon="dots" type="other" sub="onclick: on.more"></source-btn>
  </drop-area>
  <system-call ctx-name="uploader"></system-call>
  <modal-win ctx-name="uploader">
    <upload-list ctx-name="uploader"></upload-list>
  </modal-win>
  <upload-result ctx-name="uploader"></upload-result>
</shadow-wrapper>
`;

UploadWidget.reg();