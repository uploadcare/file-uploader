import { AppComponent } from '../AppComponent/AppComponent.js';

const ICONS = {
  default: 'M12 3.97C7.59 3.97 3.97 7.59 3.97 12C3.97 16.41 7.59 20.03 12 20.03C16.41 20.03 20.03 16.41 20.03 12C20.03 7.59 16.41 3.97 12 3.97M12 2C17.54 2 22 6.46 22 12C22 17.54 17.54 22 12 22C6.46 22 2 17.54 2 12C2 6.46 6.46 2 12 2M13 10.46H16L12 6.5L8 10.46H11V17.5H13',
  close: 'M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z',
};

export class ModalWin extends AppComponent {
  constructor() {
    super();
    this.initLocalState({
      closeClicked: () => {
        this.appState.pub('modalActive', false);
      },
    });
    this.addToAppState({
      modalIcon: ICONS.default,
      modalActive: false,
      modalCaption: 'Modal caption',
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this.appState.sub('modalActive', (val) => {
      val ? this.setAttribute('active', '') : this.removeAttribute('active');
    });
  }
}

ModalWin.template = /*html*/ `
<div dialog-el>
  <div heading-el>
    <icon-ui app="@path: modalIcon"></icon-ui>
    <div caption-el sub="textContent: caption" app="textContent: modalCaption"></div>
    <button close-btn sub="onclick: closeClicked">
      <icon-ui path="${ICONS.close}"></icon-ui>
    </button>
  </div>
  <slot></slot>
</div>
`;
