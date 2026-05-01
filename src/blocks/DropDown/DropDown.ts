import { html } from 'lit';

import { LitBlock } from '../../lit/LitBlock';
import { UID } from '../../utils/UID';
import './drop-down.css';
import { state } from 'lit/decorators.js';

export class DropDown extends LitBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-drop-down'];

  @state()
  private _id = UID.generateFastUid();

  private readonly _handleContentClick = (e: Event) => {
    (e.currentTarget as HTMLElement).hidePopover();
  };

  public override render() {
    return html`
      <button class="uc-mini-btn uc-dropdown-btn" popovertarget=${this._id} popovertargetaction="toggle">
        ${this.yield('dd-header-button')}
      </button>

      <div id=${this._id as string} class="uc-dropdown-content" popover="auto" @click=${this._handleContentClick}>
        ${this.yield('dd-content')}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-drop-down': DropDown;
  }
}
