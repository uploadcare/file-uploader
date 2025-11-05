import { html } from '@symbiotejs/symbiote';
import { Block } from '../../abstract/Block';
import './copyright.css';

export class Copyright extends Block {
  override initCallback() {
    super.initCallback();

    this.subConfigValue('removeCopyright', (value) => {
      this.toggleAttribute('hidden', !!value);
    });
  }

  static override template = html`
    <a
      href="https://uploadcare.com/?utm_source=copyright&utm_medium=referral&utm_campaign=v4"
      target="_blank noopener"
      class="uc-credits"
      >Powered by Uploadcare</a
    >
  `;
}
