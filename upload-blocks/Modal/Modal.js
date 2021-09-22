import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class Modal extends BlockComponent {
  constructor() {
    super();
    this.initLocalState({
      closeClicked: () => {
        this.pub('external', 'modalActive', false);
      },
    });
    this.pauseRender = true;
  }

  initCallback() {
    this.addToExternalState({
      modalIcon: 'default',
      modalActive: false,
      modalCaption: 'Modal caption',
    });
    this.render();
    this.sub('external', 'modalActive', (val) => {
      val ? this.setAttribute('active', '') : this.removeAttribute('active');
    });
  }
}

Modal.template = /*html*/ `
<div .dialog-el>
  <div .heading-el>
    <uc-icon ext="@name: modalIcon"></uc-icon>
    <div .caption-el loc="textContent: caption" ext="textContent: modalCaption"></div>
    <button .close-btn loc="onclick: closeClicked">
      <uc-icon name="close"></uc-icon>
    </button>
  </div>
  <slot></slot>
</div>
`;
