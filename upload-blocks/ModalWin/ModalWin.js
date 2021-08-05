import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class ModalWin extends BlockComponent {
  constructor() {
    super();
    this.initLocalState({
      closeClicked: () => {
        this.externalState.pub('modalActive', false);
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
    this.externalState.sub('modalActive', (val) => {
      val ? this.setAttribute('active', '') : this.removeAttribute('active');
    });
  }
}

ModalWin.template = /*html*/ `
<div dialog-el>
  <div heading-el>
    <icon-ui ext="@name: modalIcon"></icon-ui>
    <div caption-el loc="textContent: caption" ext="textContent: modalCaption"></div>
    <button close-btn loc="onclick: closeClicked">
      <icon-ui name="close"></icon-ui>
    </button>
  </div>
  <slot></slot>
</div>
`;
