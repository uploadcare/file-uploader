import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import type { OutputCollectionState } from '../../types/index';
import { applyStyles } from '../../utils/applyStyles';

export class FormInput extends LitUploaderBlock {
  public declare propertiesMeta: {
    'ctx-name': string;
  };
  private _validationInputElement: HTMLInputElement | null = null;
  private _dynamicInputsContainer: HTMLDivElement | null = null;

  private _createValidationInput(): HTMLInputElement {
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

  public override initCallback(): void {
    super.initCallback();

    this._validationInputElement = this._createValidationInput();
    this.appendChild(this._validationInputElement);

    this.sub(
      '*collectionState',
      (collectionState: OutputCollectionState | null) => {
        if (!collectionState) {
          return;
        }
        if (!this._dynamicInputsContainer) {
          const dynamicInputsContainer = document.createElement('div');
          this.appendChild(dynamicInputsContainer);
          this._dynamicInputsContainer = dynamicInputsContainer;
        }
        if (!this._validationInputElement) {
          const input = this._createValidationInput();
          this.appendChild(input);
          this._validationInputElement = input;
        }

        this._dynamicInputsContainer.innerHTML = '';

        if (collectionState.status === 'uploading' || collectionState.status === 'idle') {
          this._validationInputElement.value = '';
          this._validationInputElement.setCustomValidity('');
          return;
        }

        if (collectionState.status === 'failed') {
          const errorMsg = collectionState.errors[0]?.message;
          this._validationInputElement.value = '';
          this._validationInputElement.setCustomValidity(errorMsg ?? '');
          return;
        }

        const group = collectionState.group ? collectionState.group : null;
        if (group) {
          this._validationInputElement.value = group.cdnUrl ?? '';
          this._validationInputElement.setCustomValidity('');
          return;
        }

        const cdnUrls = collectionState.allEntries
          .map((entry) => entry.cdnUrl)
          .filter((url): url is string => typeof url === 'string');

        if (!this.cfg.multiple && cdnUrls.length === 1 && cdnUrls[0]) {
          this._validationInputElement.value = cdnUrls[0];
          this._validationInputElement.setCustomValidity('');
          return;
        }

        // Remove validation input to prevent it from being submitted
        this._validationInputElement.remove();
        this._validationInputElement = null;

        const fr = new DocumentFragment();

        for (const value of cdnUrls) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = `${this.ctxName}[]`;
          input.value = value;
          fr.appendChild(input);
        }

        this._dynamicInputsContainer.replaceChildren(fr);
      },
      false,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-form-input': FormInput;
  }
}
