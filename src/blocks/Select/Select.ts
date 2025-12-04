import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LitBlock } from '../../lit/LitBlock';
import './select.css';

type SelectOption = {
  text: string;
  value: string;
};

export class Select extends LitBlock {
  @property({ type: String, attribute: false })
  value = '';

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: Array, attribute: false })
  options: SelectOption[] = [];

  override render() {
    return html`
      <select @change=${this._handleChange} .value=${this.value} ?disabled=${this.disabled}>
        ${this.options.map((option) => html`<option value=${option.value}>${option.text}</option>`)}
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
