import { html } from 'lit';
import { ChildBlock } from '../../lit/ChildBlock';
import './copyright.css';

export class Copyright extends ChildBlock {
  protected override controllerReady(): void {
    this.subConfigValue('removeCopyright', (value) => {
      this.toggleAttribute('hidden', !!value);
    });
  }

  public override render() {
    return html`
      <a
        href="https://uploadcare.com/?utm_source=copyright&amp;utm_medium=referral&amp;utm_campaign=v4"
        target="_blank noopener"
        class="uc-credits"
        >Powered by Uploadcare</a
      >
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-copyright': Copyright;
  }
}
