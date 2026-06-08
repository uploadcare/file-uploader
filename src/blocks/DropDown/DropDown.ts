import { html, LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import '../../blocks/DropDown/drop-down.css';
import { LightDomMixin } from '../../lit/LightDomMixin';
import { UID } from '../../utils/UID';

/**
 * v2 `<uc-drop-down>`. Light-DOM popover wrapper used by DynamicBtn for
 * its overflow menu. Headless: the user supplies the trigger button via
 * the `dd-header-button` slot (via `yield`) and the menu content via
 * `dd-content`. No controller dependency — pure DOM utility.
 *
 * Same `[uc-drop-down]` style attribute as v1 so `drop-down.css`
 * applies unchanged.
 */
export class DropDown extends LightDomMixin(LitElement) {
  public static styleAttrs: string[] = ['uc-drop-down'];

  @state()
  private _id = UID.generateFastUid();

  private readonly _handleContentClick = (e: Event): void => {
    (e.currentTarget as HTMLElement).hidePopover();
  };

  public override connectedCallback(): void {
    super.connectedCallback();
    const ctor = this.constructor as typeof DropDown;
    for (const attr of ctor.styleAttrs) {
      if (!this.hasAttribute(attr)) this.setAttribute(attr, '');
    }
  }

  public override render() {
    const popoverId = this._id as string;
    return html`
      <button
        class="uc-mini-btn uc-dropdown-btn"
        popovertarget=${popoverId}
        popovertargetaction="toggle"
      >
        ${this.yield('dd-header-button')}
      </button>
      <div
        id=${popoverId}
        class="uc-dropdown-content"
        popover="auto"
        @click=${this._handleContentClick}
      >
        ${this.yield('dd-content')}
      </div>
    `;
  }
}

if (!customElements.get('uc-drop-down')) customElements.define('uc-drop-down', DropDown);

// Tag is globally declared by v1's `src/blocks/DropDown/DropDown.ts`. v2
// registers the same tag with a different class at runtime.
