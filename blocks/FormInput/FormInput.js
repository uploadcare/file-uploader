// @ts-check
import { applyStyles } from '@symbiotejs/symbiote';
import { UploaderBlock } from '../../abstract/UploaderBlock.js';

export class FormInput extends UploaderBlock {
  requireCtxName = true;

  _createValidationInput() {
    const validationInput = document.createElement('input');
    validationInput.type = 'text';
    validationInput.name = this.ctxName;
    validationInput.required = this.cfg.multipleMin > 0;
    validationInput.tabIndex = -1;
    applyStyles(validationInput, {
      opacity: 0,
      height: 0,
      width: 0,
    });
    return validationInput;
  }

  initCallback() {
    super.initCallback();

    const validationInput = this._createValidationInput();
    this.appendChild(validationInput);
    this._validationInputElement = validationInput;

    this.sub(
      '*collectionState',
      (/** @type {import('../../types/index.js').OutputCollectionState} */ collectionState) => {
        {
          if (!this._dynamicInputsContainer) {
            this._dynamicInputsContainer = document.createElement('div');
            this.appendChild(this._dynamicInputsContainer);
          }
          if (!this._validationInputElement) {
            const input = this._createValidationInput();
            this.appendChild(input);
            this._validationInputElement = input;
          }

          this._dynamicInputsContainer.innerHTML = '';

          if (collectionState.status === 'uploading' || collectionState.status === 'idle') {
            validationInput.value = '';
            validationInput.setCustomValidity('');
            return;
          }

          if (collectionState.status === 'failed') {
            const errorMsg = collectionState.errors[0]?.message;
            validationInput.value = '';
            validationInput.setCustomValidity(errorMsg);
            return;
          }

          const group = collectionState.group ? collectionState.group : null;
          if (group) {
            validationInput.value = group.cdnUrl;
            validationInput.setCustomValidity('');
            return;
          }

          const cdnUrls = collectionState.allEntries.map((entry) => entry.cdnUrl);

          // Remove validation input to prevent it from being submitted
          validationInput.remove();
          this._validationInputElement = null;

          for (let value of cdnUrls) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = `${this.ctxName}[]`;
            input.value = value;
            this._dynamicInputsContainer.appendChild(input);
          }
        }
      },
      false,
    );
  }
}
