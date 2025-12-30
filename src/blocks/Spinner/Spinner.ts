import { html } from 'lit';
import { LitBlock } from '../../lit/LitBlock';
import './spinner.css';

export class Spinner extends LitBlock {
  public override render() {
    return html` <div class="uc-spinner"></div> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-spinner': Spinner;
  }
}
