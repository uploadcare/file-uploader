import { property } from 'lit/decorators.js';
import { ChildBlock } from '../../abstract/ChildBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import type { OutputCollectionState } from '../../types/exported';
import { applyStyles } from '../../utils/applyStyles';

/**
 * v2-compat shim — `<uc-form-input>`.
 *
 * Reflects the upload-collection state into hidden `<input>` elements
 * so the surrounding `<form>` can submit Uploadcare CDN URLs without
 * any extra glue. Same behavior as v1:
 *  - Single mode (`!multiple` and one entry): one `<input name="X">`
 *    holding the file's `cdnUrl`.
 *  - Group output: one `<input name="X">` holding the group `cdnUrl`.
 *  - Multiple mode: one `<input name="X[]">` per entry, value =
 *    `cdnUrl`.
 *  - Collection-level failures populate the validation input's
 *    `setCustomValidity` so native form submission is blocked.
 *
 * Reads `multipleMin` to mark the validation input as `required` and
 * resolves `name` from the element's `name` attribute, falling back to
 * `ctx-name` for unique scoping when several uploaders share the same
 * page.
 */
export class FormInput extends ChildBlock {
  @property({ type: String, attribute: 'name' })
  public nameAttrValue?: string;

  private _validationInput: HTMLInputElement | null = null;
  private _dynamicInputsContainer: HTMLDivElement | null = null;

  protected override controllerReady(ctrl: UploaderController): void {
    this._ensureContainers();
    this._sync(ctrl);
  }

  protected override controllerReleased(): void {
    if (this._validationInput) {
      this._validationInput.remove();
      this._validationInput = null;
    }
    if (this._dynamicInputsContainer) {
      this._dynamicInputsContainer.remove();
      this._dynamicInputsContainer = null;
    }
  }

  protected override subscriptionsFor(ctrl: UploaderController): Array<(listener: () => void) => () => void> {
    const sync = (): void => this._sync(ctrl);
    return [
      (listener) =>
        ctrl.config.subscribe(() => {
          listener();
          sync();
        }),
      (listener) =>
        ctrl.collection.subscribe(() => {
          listener();
          sync();
        }),
      (listener) =>
        ctrl.upload.subscribe(() => {
          listener();
          sync();
        }),
      (listener) =>
        ctrl.validation.subscribe(() => {
          listener();
          sync();
        }),
    ];
  }

  public override render(): null {
    return null;
  }

  private get _inputName(): string {
    return this.nameAttrValue ?? this.ctxName ?? '';
  }

  private _createValidationInput(name: string, required: boolean): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = name;
    input.required = required;
    input.tabIndex = -1;
    applyStyles(input, { opacity: 0, height: 0, width: 0 });
    return input;
  }

  private _ensureContainers(): void {
    if (!this._dynamicInputsContainer) {
      this._dynamicInputsContainer = document.createElement('div');
      this.appendChild(this._dynamicInputsContainer);
    }
    if (!this._validationInput) {
      const cfg = (this.uploaderOrNull?.config.values ?? {}) as { multipleMin?: number };
      this._validationInput = this._createValidationInput(this._inputName, (cfg.multipleMin ?? 0) > 0);
      this.appendChild(this._validationInput);
    }
  }

  private _sync(ctrl: UploaderController): void {
    this._ensureContainers();
    const cfg = ctrl.config.values as {
      multiple?: boolean;
      multipleMin?: number;
      groupOutput?: boolean;
    };
    const state = ctrl.api.getOutputCollectionState() as OutputCollectionState;
    const name = this._inputName;

    if (this._validationInput) {
      this._validationInput.name = name;
      this._validationInput.required = (cfg.multipleMin ?? 0) > 0;
    }

    if (this._dynamicInputsContainer) this._dynamicInputsContainer.innerHTML = '';

    if (state.status === 'idle' || state.status === 'uploading') {
      this._ensureValidationInput();
      this._validationInput!.value = '';
      this._validationInput?.setCustomValidity('');
      return;
    }

    if (state.status === 'failed') {
      this._ensureValidationInput();
      this._validationInput!.value = '';
      const message = state.errors[0]?.message ?? '';
      this._validationInput?.setCustomValidity(message);
      return;
    }

    const group = state.group ?? null;
    if (group) {
      this._ensureValidationInput();
      this._validationInput!.value = group.cdnUrl ?? '';
      this._validationInput?.setCustomValidity('');
      return;
    }

    const cdnUrls = state.allEntries
      .map((entry) => entry.cdnUrl)
      .filter((url): url is string => typeof url === 'string');

    if (!cfg.multiple && cdnUrls.length === 1 && cdnUrls[0]) {
      this._ensureValidationInput();
      this._validationInput!.value = cdnUrls[0];
      this._validationInput?.setCustomValidity('');
      return;
    }

    // Multi-file mode with at least one CDN URL — emit a `<input name="X[]">`
    // per entry. Drop the validation input so it doesn't submit a stale value.
    if (this._validationInput) {
      this._validationInput.remove();
      this._validationInput = null;
    }

    if (cdnUrls.length === 0) return;

    const fragment = document.createDocumentFragment();
    for (const value of cdnUrls) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = `${name}[]`;
      input.value = value;
      fragment.appendChild(input);
    }
    this._dynamicInputsContainer?.replaceChildren(fragment);
  }

  private _ensureValidationInput(): void {
    if (this._validationInput) return;
    const ctrl = this.uploaderOrNull;
    const cfg = (ctrl?.config.values ?? {}) as { multipleMin?: number };
    this._validationInput = this._createValidationInput(this._inputName, (cfg.multipleMin ?? 0) > 0);
    this.appendChild(this._validationInput);
  }
}

if (!customElements.get('uc-form-input')) {
  customElements.define('uc-form-input', FormInput);
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-form-input': FormInput;
  }
}
