import { html } from 'lit';

import { LitBlock } from '../../lit/LitBlock';
import { UID } from '../../utils/UID';
import './drop-down.css';

export class DropDown extends LitBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-drop-down'];

  private _id = UID.generateFastUid();

  private readonly _handleContentClick = (e: Event) => {
    (e.currentTarget as HTMLElement).hidePopover();
  };

  public override render() {
    return html`
      <button class="uc-mini-btn uc-dropdown-btn" popovertarget=${this._id} popovertargetaction="toggle">
        ${this.yield('dd-header-button')}
      </button>

      <div id=${this._id} class="uc-dropdown-content" popover="auto" @click=${this._handleContentClick}>
        ${this.yield('dd-content')}
      </div>
    `;
  }
}
