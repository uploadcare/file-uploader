import { Block } from '../../abstract/Block.js';
import { strokesCssBg } from '../svg-backgrounds/svg-backgrounds.js';

export class Modal extends Block {
  init$ = {
    '*modalActive': false,
    '*modalHeaderHidden': false,
    closeClicked: () => {
      this.set$({
        '*modalActive': false,
        '*currentActivity': '',
      });
    },
  };

  initCallback() {
    this.sub('*modalActive', (val) => {
      val ? this.setAttribute('active', '') : this.removeAttribute('active');
      if (val && this.getCssData('--cfg-modal-scroll-lock')) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = null;
      }
    });
    if (this.getCssData('--cfg-modal-backdrop-strokes')) {
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
