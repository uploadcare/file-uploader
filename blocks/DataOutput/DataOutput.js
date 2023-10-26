// @ts-check
import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { uploadFileGroup } from '@uploadcare/upload-client';
import { applyStyles } from '@symbiotejs/symbiote';

/**
 * @typedef {| import('../../types/exported.js').OutputFileEntry[]
 *   | {
 *       groupData: import('@uploadcare/upload-client').GroupInfo;
 *       files: import('../../types/exported.js').OutputFileEntry[];
 *     }} Output}
 */

export class DataOutput extends UploaderBlock {
  processInnerHtml = true;
  requireCtxName = true;

  constructor() {
    super();
    this.init$ = {
      ...this.init$,
      output: null,
    };
  }

  get dict() {
    return DataOutput.dict;
  }

  get validationInput() {
    return this._validationInputElement;
  }

  initCallback() {
    super.initCallback();

    if (this.hasAttribute(this.dict.FORM_INPUT_ATTR)) {
      this._dynamicInputsContainer = document.createElement('div');
      this.appendChild(this._dynamicInputsContainer);

      let input = document.createElement('input');
      input.type = 'text';
      input.name = '__UPLOADCARE_VALIDATION_INPUT__';
      input.required = this.hasAttribute(this.dict.INPUT_REQUIRED);
      input.tabIndex = -1;
      applyStyles(input, {
        opacity: 0,
        height: 0,
        width: 0,
      });
      this.appendChild(input);
      this._validationInputElement = input;
    }

    this.sub(
      'output',
      /** @param {Output} data */
      (data) => {
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

        if (this.hasAttribute(this.dict.FORM_INPUT_ATTR) && this._dynamicInputsContainer) {
          this._dynamicInputsContainer.innerHTML = '';
          /** @type {string[]} */
          let values;
          if (Array.isArray(data)) {
            values = data.map((file) => /** @type {string} */ (file.cdnUrl));
          } else if (data?.groupData) {
            values = [data.groupData.cdnUrl];
          } else {
            values = [];
          }
          for (let value of values) {
            let input = document.createElement('input');
            input.type = 'hidden';
            input.name = this.getAttribute(this.dict.INPUT_NAME_ATTR) || this.ctxName;
            input.value = value ?? '';
            this._dynamicInputsContainer.appendChild(input);
          }
          if (this._validationInputElement) {
            this._validationInputElement.value = values.length ? '__VALUE__' : '';
            const msg = this.$['*message'];
            if (msg?.isError) {
              this._validationInputElement.setCustomValidity(`${msg.caption}. ${msg.text}`);
            } else {
              this._validationInputElement.setCustomValidity('');
            }
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
      async (/** @type {import('../../types/exported.js').OutputFileEntry[]} */ data) => {
        if (!data || !data.length) {
          this.$.output = null;
          return;
        }
        const allUploaded = data.every((item) => item.isUploaded);
        if (allUploaded && (this.cfg.groupOutput || this.hasAttribute(this.dict.GROUP_ATTR))) {
          let uuidList = data.map((fileDesc) => {
            return fileDesc.uuid + (fileDesc.cdnUrlModifiers ? `/${fileDesc.cdnUrlModifiers}` : '');
          });
          const validationOk = data.every((item) => item.isValid);
          if (!validationOk) {
            this.$.output = {
              groupData: undefined,
              files: data,
            };
            return;
          }
          const uploadClientOptions = this.getUploadClientOptions();
          const resp = await uploadFileGroup(uuidList, uploadClientOptions);
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

DataOutput.dict = Object.freeze({
  SRC_CTX_KEY: '*outputData',
  EVENT_NAME: 'lr-data-output',
  FIRE_EVENT_ATTR: 'use-event',
  CONSOLE_ATTR: 'use-console',
  GROUP_ATTR: 'use-group',
  FORM_INPUT_ATTR: 'use-input',
  INPUT_NAME_ATTR: 'input-name',
  INPUT_REQUIRED: 'input-required',
});
