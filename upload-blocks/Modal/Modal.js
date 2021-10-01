import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class Modal extends BlockComponent {
  init$ = {
    caption: '',
    closeClicked: () => {
      this.$['*modalActive'] = false;
    },
  };

  pauseRender = true;

  initCallback() {
    this.add$({
      '*modalIcon': 'default',
      '*modalActive': false,
      '*modalCaption': 'Modal caption',
    });
    this.render();
    this.sub('*modalActive', (val) => {
      val ? this.setAttribute('active', '') : this.removeAttribute('active');
    });
  }
}

Modal.template = /*html*/ `
<div .dialog-el>
  <div .heading-el>
    <uc-icon set="@name: *modalIcon"></uc-icon>
    <div .caption-el set="textContent: caption, *modalCaption"></div>
    <button .close-btn set="onclick: closeClicked">
      <uc-icon name="close"></uc-icon>
    </button>
  </div>
  <slot></slot>
</div>
`;
