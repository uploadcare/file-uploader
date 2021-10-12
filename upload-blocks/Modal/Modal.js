import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class Modal extends BlockComponent {
  init$ = {
    caption: '',
    '*modalIcon': 'default',
    '*modalActive': false,
    '*modalCaption': 'Modal caption',
    closeClicked: () => {
      this.$['*modalActive'] = false;
    },
  };

  initCallback() {
    this.sub('*modalActive', (val) => {
      val ? this.setAttribute('active', '') : this.removeAttribute('active');
    });
  }
}

Modal.template = /*html*/ `
<div .dialog>
  <div .heading>
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
