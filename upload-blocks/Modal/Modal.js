import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { strokesCssBg } from '../svg-backgrounds/svg-backgrounds.js';

export class Modal extends BlockComponent {
  init$ = {
    '*modalActive': false,
    '*modalHeaderHidden': false,
    closeClicked: () => {
      this.$['*modalActive'] = false;
    },
  };

  initCallback() {
    this.sub('*modalActive', (val) => {
      val ? this.setAttribute('active', '') : this.removeAttribute('active');
    });
    if (this.hasAttribute('strokes')) {
      this.style.backgroundImage = `url(${strokesCssBg()})`;
    }
  }
}

Modal.template = /*html*/ `
<div class="dialog">
  <div class="heading" set="@hidden: *modalHeaderHidden">
    <slot name="heading"></slot>
    <button
      class="close-btn"
      set="onclick: closeClicked">
      <uc-icon name="close"></uc-icon>
    </button>
  </div>
  <div class="content">
    <slot></slot>
  </div>
</div>
`;
