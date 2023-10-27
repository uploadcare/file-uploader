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
          let cdnUrls = [];
          /** @type {import('../../index.js').OutputFileEntry[]} */
          let files = [];
          if (Array.isArray(data)) {
            cdnUrls = data.map((file) => /** @type {string} */ (file.cdnUrl));
            files = data;
          } else if (data?.files) {
            cdnUrls = data.groupData ? [data.groupData.cdnUrl] : [];
            files = data.files;
          }
          for (let value of cdnUrls) {
            let input = document.createElement('input');
            input.type = 'hidden';
            input.name = this.getAttribute(this.dict.INPUT_NAME_ATTR) || this.ctxName;
            input.value = value ?? '';
            this._dynamicInputsContainer.appendChild(input);
          }
          if (this._validationInputElement) {
            this._validationInputElement.value = cdnUrls.length ? '__VALUE__' : '';
            const firstInvalidFile = files.find((file) => !file.isValid);
            const firstInvalidFileMsg =
              firstInvalidFile?.validationErrorMessage ?? firstInvalidFile?.uploadError?.message;
            let globalMsg = this.$['*message'];
            globalMsg = globalMsg?.isError ? `${globalMsg.caption}. ${globalMsg.text}` : undefined;
            const msg = firstInvalidFileMsg ?? globalMsg;
            if (msg) {
              this._validationInputElement.setCustomValidity(msg);
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
        if (this.cfg.groupOutput || this.hasAttribute(this.dict.GROUP_ATTR)) {
          const isAllUploadedAndValid = data.every((item) => item.isUploaded && item.isValid);
          if (!isAllUploadedAndValid) {
            this.$.output = {
              groupData: undefined,
              files: data,
            };
            return;
          }

          const uploadClientOptions = await this.getUploadClientOptions();
          const uuidList = data.map((fileDesc) => {
            return fileDesc.uuid + (fileDesc.cdnUrlModifiers ? `/${fileDesc.cdnUrlModifiers}` : '');
          });
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
