import { html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import '../../blocks/Select/select.css';
import { LightDomMixin } from '../../lit/LightDomMixin';

interface SelectOption {
  text: string;
  value: string;
}

/**
 * v2 `<uc-select>`. Stateless wrapper around a native `<select>` with
 * value/options/disabled props and a forwarded `change` event. v1's
 * `select.css` styles the tag directly so visuals are inherited.
 */
export class Select extends LightDomMixin(LitElement) {
  @property({ type: String, attribute: false })
  public value = '';

  @property({ type: Boolean, reflect: true })
  public disabled = false;

  @property({ type: Array, attribute: false })
  public options: SelectOption[] = [];

  private _handleChange = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled) return;
    const target = event.currentTarget as HTMLSelectElement | null;
    if (!target) return;
    this.value = target.value;
    this.dispatchEvent(new Event('change'));
  };

  public override render() {
    return html`
      <select
        @change=${this._handleChange}
        .value=${this.value}
        ?disabled=${this.disabled}
      >
        ${this.options.map((opt) => html`<option value=${opt.value}>${opt.text}</option>`)}
      </select>
    `;
  }
}

if (!customElements.get('uc-select')) customElements.define('uc-select', Select);
