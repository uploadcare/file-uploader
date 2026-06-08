import { html } from 'lit';
import '../../blocks/StartFrom/start-from.css';
import { ActivityBlock } from '../../abstract/ActivityBlock';

/**
 * v2 `<uc-start-from>`. Activity wrapper for the source-picker view.
 * Toggles `[active]` when the router activity is `start-from`. v1's
 * `start-from.css` styles the tag directly so visuals are inherited.
 */
export class StartFrom extends ActivityBlock {
  public override activityType = 'start-from';

  public override render() {
    return html`<div class="uc-content">${this.yield('')}</div>`;
  }
}

if (!customElements.get('uc-start-from')) customElements.define('uc-start-from', StartFrom);
