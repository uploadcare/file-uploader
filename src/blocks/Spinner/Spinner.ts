import { html } from 'lit';
import { LitBlock } from '../../lit/LitBlock';
import './spinner.css';

export class Spinner extends LitBlock {
  override render() {
    return html` <div class="uc-spinner"></div> `;
  }
}
