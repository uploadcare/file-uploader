import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { uploadFileGroup } from '@uploadcare/upload-client';

/** @typedef {import('@uploadcare/upload-client').UploadcareFile[]} FileList} */

export class DataOutput extends UploaderBlock {
  processInnerHtml = true;

  init$ = {
    ...this.ctxInit,
    output: null,
    filesData: null,
  };

  cssInit$ = {
    '--cfg-group-output': 0,
  };

  get dict() {
    return DataOutput.dict;
  }

  initCallback() {
    super.initCallback();
    this.sub(
      'output',
      (data) => {
        if (!data) {
          return;
        }

        if (this.hasAttribute(this.dict.FIRE_EVENT_ATTR)) {
          this.dispatchEvent(
            new CustomEvent(this.dict.EVENT_NAME, {
              bubbles: true,
              composed: true,
              detail: {
                timestamp: Date.now(),
                ctxName: this.ctxName,
                data,
              },
            })
          );
        }

        if (this.hasAttribute(this.dict.FORM_INPUT_ATTR)) {
          this.innerHTML = '';
          let values = data.groupData ? [data.groupData.cdnUrl] : data.map((file) => file.cdnUrl);
          for (let value of values) {
            let input = document.createElement('input');
            input.type = 'text';
            input.name = this.getAttribute(this.dict.INPUT_NAME_ATTR) || this.ctxName;
            input.hidden = true;
            input.value = value;
            this.appendChild(input);
          }
        }

        if (this.hasAttribute(this.dict.CONSOLE_ATTR)) {
          console.log(data);
        }
      },
      false
    );

    this.sub(
      this.dict.SRC_CTX_KEY,
      async (/** @type {FileList} */ data) => {
        if (!data) {
          this.$.output = null;
          this.$.filesData = null;
          return;
        }
        this.$.filesData = data;
        if (this.getCssData('--cfg-group-output') || this.hasAttribute(this.dict.GROUP_ATTR)) {
          let uuidList = data.map((fileDesc) => {
            return fileDesc.uuid;
          });
          let resp = await uploadFileGroup(uuidList, {
            ...this.getUploadClientOptions(),
          });
          this.$.output = {
            groupData: resp,
            files: data,
          };
        } else {
          this.$.output = data;
        }
      },
      false
    );
  }
}

/** @enum {Object<[x: string], string>} */
DataOutput.dict = {
  SRC_CTX_KEY: '*outputData',
  EVENT_NAME: 'lr-data-output',
  FIRE_EVENT_ATTR: 'use-event',
  CONSOLE_ATTR: 'use-console',
  GROUP_ATTR: 'use-group',
  FORM_INPUT_ATTR: 'use-input',
  INPUT_NAME_ATTR: 'input-name',
};
