import type { PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { CollectionStateController } from '../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { inject } from '../../abstract/di/inject';
import { ChildBlock } from '../../lit/ChildBlock';
import type { OutputCollectionState } from '../../types/index';
import { applyStyles } from '../../utils/applyStyles';

export class FormInput extends ChildBlock {
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;

  public declare attributesMeta: {
    'ctx-name': string;
    name?: string;
  };
  private _validationInputElement: HTMLInputElement | null = null;
  private _dynamicInputsContainer: HTMLDivElement | null = null;
  // Dedup guard: the collection state is republished as a fresh object per change
  // (`Object.is` differs), so this reproduces the v1 `bag.ctx.sub('*collectionState')`
  // "rebuild only on an actual change" semantics now that the rebuild is driven by
  // a re-render (which `willUpdate` also runs for unrelated updates, e.g. `ctx-name`).
  private _lastSyncedState: OutputCollectionState | null = null;

  @property({ type: String, noAccessor: true, attribute: 'name' })
  public nameAttrValue?: string;

  private get _inputName(): string {
    return this.nameAttrValue ?? this.effectiveCtxName ?? '';
  }

  private _createValidationInput(): HTMLInputElement {
    const validationInput = document.createElement('input');
    validationInput.type = 'text';
    validationInput.name = this._inputName;
    validationInput.required = this._config.get('multipleMin') > 0;
    validationInput.tabIndex = -1;
    applyStyles(validationInput, {
      opacity: 0,
      height: 0,
      width: 0,
    });
    return validationInput;
  }

  protected override controllerReady(): void {
    // `controllerReady` re-runs on controller re-adoption — guard the append
    // so duplicate hidden inputs can't stack (same guard as `_syncFormInputs`).
    if (!this._validationInputElement) {
      this._validationInputElement = this._createValidationInput();
      this.appendChild(this._validationInputElement);
    }
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    // Reactive collection-state read (replaces the v1
    // `bag.ctx.sub('*collectionState', …, false)` subscription): `getTracked`
    // auto-tracks under `SignalWatcher`, so a new collection state re-runs this
    // update and rebuilds the hidden `<input>`(s). The `false` (no immediate
    // fire) of the v1 sub is preserved by the initial `null` state falling
    // through the early-return in `_syncFormInputs`.
    this._syncFormInputs(this._collectionState.getTracked('collectionState'));
  }

  private _syncFormInputs(collectionState: OutputCollectionState | null): void {
    if (!collectionState) {
      return;
    }
    if (Object.is(collectionState, this._lastSyncedState)) {
      return;
    }
    this._lastSyncedState = collectionState;

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

    if (!this._config.get('multiple') && cdnUrls.length === 1 && cdnUrls[0]) {
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
      input.name = `${this._inputName}[]`;
      input.value = value;
      fr.appendChild(input);
    }

    this._dynamicInputsContainer.replaceChildren(fr);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-form-input': FormInput;
  }
}
