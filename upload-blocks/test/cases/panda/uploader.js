import { UploadWidget } from '../../../index.js';
import { TPL } from './template.js';

class InlineUploader extends UploadWidget {
  init$ = {
    selectClicked: () => {
      this.ref.dropArea['openSystemDialog']();
      this.ref.dropArea.hidden = true;
    },
  };
}

InlineUploader.template = TPL;
InlineUploader.reg('inline-uploader');
