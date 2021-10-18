import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { strokesCssBg } from '../svg-backgrounds/svg-backgrounds.js';

export class Modal extends BlockComponent {
  init$ = {
    caption: '',
    '*modalIcon': 'default',
    '*modalActive': false,
    '*modalCaption': 'Modal caption',
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
<div .dialog>
  <div .heading set="@hidden: *modalHeaderHidden">
    <uc-icon set="@name: *modalIcon"></uc-icon>
    <div 
      .caption 
      set="textContent: caption, *modalCaption">
    </div>
    <button
      .close-btn 
      set="onclick: closeClicked">
      <uc-icon name="close"></uc-icon>
    </button>
  </div>
  <slot></slot> 
</div>
`;
