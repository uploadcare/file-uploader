import { html, Symbiote } from '@symbiotejs/symbiote';
import './spinner.css';

export class Spinner extends Symbiote<void> {}

Spinner.template = html` <div class="uc-spinner"></div> `;
