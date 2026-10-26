import { html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { ChildBlock } from '../../lit/ChildBlock';
import '../Icon/Icon';
import './select.css';

type SelectOption = {
  text: string;
  value: string;
};

export class Select extends ChildBlock {
  @property({ type: String, attribute: false })
  public value = '';

  @property({ type: Boolean, reflect: true })
  public disabled = false;

  @property({ type: Array, attribute: false })
  public options: SelectOption[] = [];

  public override render() {
    // The browser shows the first option when the value matches none.
    const selected = this.options.find((option) => option.value === this.value) ?? this.options[0];
    return html`
      <select @change=${this._handleChange} ?disabled=${this.disabled} title=${selected?.text ?? ''}>
        ${this.options.map((option) => html`<option value=${option.value}>${option.text}</option>`)}
      </select>
      <uc-icon name="arrow-dropdown"></uc-icon>
    `;
  }

  // Applied after render rather than bound in the template: a `.value` binding on `<select>` commits before its
  // `<option>`s exist, and Lit's dirty check never re-applies it when the options change. A value that matches no
  // option is left alone so the browser keeps its first-option default.
  public override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);
    const select = this.querySelector('select');
    if (select && this.options.some((option) => option.value === this.value)) {
      select.value = this.value;
    }
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
