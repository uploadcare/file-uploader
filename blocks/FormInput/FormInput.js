// @ts-check
import { applyStyles } from '@symbiotejs/symbiote';
import { UploaderBlock } from '../../abstract/UploaderBlock.js';

const VALIDATION_INPUT_NAME = '__UPLOADCARE_VALIDATION_INPUT__';

export class FormInput extends UploaderBlock {
  requireCtxName = true;

  get validationInput() {
    return this._validationInputElement;
  }

  initCallback() {
    super.initCallback();

    this._dynamicInputsContainer = document.createElement('div');
    this.appendChild(this._dynamicInputsContainer);

    const validationInput = document.createElement('input');
    validationInput.type = 'text';
    validationInput.name = VALIDATION_INPUT_NAME;
    validationInput.required = this.cfg.multipleMin > 0;
    validationInput.tabIndex = -1;
    applyStyles(validationInput, {
      opacity: 0,
      height: 0,
      width: 0,
    });
    this.appendChild(validationInput);
    this._validationInputElement = validationInput;

    this.sub(
      '*collectionState',
      async (/** @type {import('../../types/index.js').OutputCollectionState} */ collectionState) => {
        {
          if (this._dynamicInputsContainer) {
            this._dynamicInputsContainer.innerHTML = '';

            if (collectionState.status === 'uploading' || collectionState.status === 'idle') {
              validationInput.name = VALIDATION_INPUT_NAME;
              validationInput.value = '';
              validationInput.setCustomValidity('');
              return;
            }

            if (collectionState.status === 'failed') {
              const errorMsg = collectionState.errors[0]?.message;
              validationInput.name = VALIDATION_INPUT_NAME;
              validationInput.value = '';
              validationInput.setCustomValidity(errorMsg);
              return;
            }

            const group = 'group' in collectionState ? collectionState.group : null;
            if (group) {
              validationInput.name = this.ctxName;
              validationInput.value = group.cdnUrl;
              validationInput.setCustomValidity('');
              return;
            }

            const cdnUrls = collectionState.allEntries.map((entry) => entry.cdnUrl);
            for (let value of cdnUrls) {
              const input = document.createElement('input');
              input.type = 'hidden';
              input.name = this.ctxName;
              input.value = value ?? '';
              this._dynamicInputsContainer.appendChild(input);
            }
          }
        }
      },
      false,
    );
  }
}
