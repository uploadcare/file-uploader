import { html } from 'lit';
import { LitBlock } from '../../lit/LitBlock';
import './copyright.css';

export class Copyright extends LitBlock {
  override initCallback(): void {
    super.initCallback();

    this.subConfigValue('removeCopyright', (value) => {
      this.toggleAttribute('hidden', !!value);
    });
  }

  override render() {
    return html`
      <a
        href="https://uploadcare.com/?utm_source=copyright&utm_medium=referral&utm_campaign=v4"
        target="_blank noopener"
        class="uc-credits"
        >Powered by Uploadcare</a
      >
    `;
  }
}
