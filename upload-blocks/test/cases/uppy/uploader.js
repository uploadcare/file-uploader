import { UploadWidget } from '../../../index.js';
import { TPL } from './template.js';

class InlineUploader extends UploadWidget {
  init$ = {
    '*currentActivity': 'source-select',
    '*modalIcon': 'default',
    '*modalCaption': 'Select upload source',
    '*outputData': null,
    canceBtnHidden: true,
    cancelClicked: () => {
      this.set$({
        '*outputData': null,
        '*currentActivity': 'source-select',
        canceBtnHidden: true,
      });
      this.$['*uploadCollection']?.clearAll();
    },
  };

  initCallback() {
    this.sub('*outputData', (/** @type {any[]} */ data) => {
      if (data && data.length) {
        this.$.canceBtnHidden = false;
      }
    });
  }
}

InlineUploader.template = TPL;
InlineUploader.reg('inline-uploader');
