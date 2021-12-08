import { UC } from '../../../index.js';
import { TPL } from './template.js';

class InlineUploader extends UC.BlockComponent {
  init$ = {
    '*currentActivity': 'source-select',
    selectClicked: (e) => {
      e.preventDefault();
      this.ref.dropArea['openSystemDialog']();
    },
  };
}

InlineUploader.template = TPL;
InlineUploader.reg('inline-uploader');
