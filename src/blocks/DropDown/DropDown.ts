import { html } from 'lit';

import { ChildBlock } from '../../lit/ChildBlock';
import { UID } from '../../utils/UID';
import './drop-down.css';
import { property, state } from 'lit/decorators.js';

export class DropDown extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-drop-down'];

  /** Accessible name of the trigger, whose visible content is usually an icon only. */
  @property()
  public label?: string;

  @state()
  private _id = UID.generateFastUid();

  private readonly _handleContentClick = (e: Event) => {
    (e.currentTarget as HTMLElement).hidePopover();
  };

  public override render() {
    return html`
      <button
        type="button"
        class="uc-mini-btn uc-dropdown-btn"
        popovertarget=${this._id as string}
        popovertargetaction="toggle"
        aria-label=${this.label ?? this.l10n('src-type-other')}
      >
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
