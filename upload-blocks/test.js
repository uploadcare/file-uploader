import { ShadowWrapper } from '../shadow-wrapper-element/ShadowWrapper.js';
import { UploadSourceSelect } from './UploadSourceSelect/UploadSourceSelect.js';
import { ModalWin } from './ModalWin/ModalWin.js';
import { UploadList } from './UploadList/UploadList.js';
import { UrlSource } from './UrlSource/UrlSource.js';
import { UploadOutput } from './UploadOutput/UploadOutput.js';

window.customElements.define('shadow-wrapper', ShadowWrapper);
window.customElements.define('upload-source-select', UploadSourceSelect);
window.customElements.define('modal-win', ModalWin);
window.customElements.define('upload-list', UploadList);
window.customElements.define('url-source', UrlSource);
window.customElements.define('upload-output', UploadOutput);

export { ShadowWrapper, UploadSourceSelect, UploadList, ModalWin, UrlSource, UploadOutput };
