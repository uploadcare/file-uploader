import { html } from 'lit';
import '../../blocks/Copyright/copyright.css';
import { ChildBlock } from '../../abstract/ChildBlock';

/**
 * v2 `<uc-copyright>`. Renders the "Powered by Uploadcare" link; hides
 * itself when `config.removeCopyright` is set. v1's `copyright.css`
 * targets the tag name so visuals are inherited.
 */
export class Copyright extends ChildBlock {
  public override render() {
    const remove = !!this.uploaderOrNull?.config.values.removeCopyright;
    this.toggleAttribute('hidden', remove);
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

if (!customElements.get('uc-copyright')) customElements.define('uc-copyright', Copyright);
