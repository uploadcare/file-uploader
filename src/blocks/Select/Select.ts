import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { LitBlock } from '../../lit/LitBlock';
import './select.css';

type SelectOption = {
  text: string;
  value: string;
};

export class Select extends LitBlock {
  @property({ type: String, attribute: false })
  public value = '';

  @property({ type: Boolean, reflect: true })
  public disabled = false;

  @property({ type: Array, attribute: false })
  public options: SelectOption[] = [];

  public override render() {
    return html`
      <select @change=${this._handleChange} .value=${this.value} ?disabled=${this.disabled}>
        ${this.options.map(
          // `.value` on <select> is applied before the options exist, so a value that arrives together with the options
          // would be lost without marking the option itself.
          (option) =>
            html`<option value=${option.value} ?selected=${option.value === this.value}>${option.text}</option>`,
        )}
      </select>
    `;
  }

  private _handleChange = (event: Event): void => {
    if (this.disabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const selectEl = event.currentTarget as HTMLSelectElement | null;
    if (!selectEl) {
      return;
    }

    this.value = selectEl.value;
    this.dispatchEvent(new Event('change'));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-select': Select;
  }
}
