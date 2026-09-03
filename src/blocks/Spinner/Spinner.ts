import { html } from 'lit';
import { ChildBlock } from '../../lit/ChildBlock';
import './spinner.css';

export class Spinner extends ChildBlock {
  public override render() {
    return html` <div class="uc-spinner"></div> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-spinner': Spinner;
  }
}
