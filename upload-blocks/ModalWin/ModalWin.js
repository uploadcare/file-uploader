import { AppComponent } from '../AppComponent/AppComponent.js';

export class ModalWin extends AppComponent {
  constructor() {
    super();
    this.initLocalState({
      closeClicked: () => {
        this.appState.pub('modalActive', false);
      },
    });
    this.addToAppState({
      modalActive: false,
      modalCaption: 'Modal caption',
    });
  }

  connectedCallback() {
    this._initChildren = [];
    this.childNodes.forEach((el) => {
      this._initChildren.push(el);
    });
    super.connectedCallback();
    this.render();
    this._initChildren.forEach((el) => {
      this.refs['content-el'].appendChild(el);
    });
    this.appState.sub('modalActive', (val) => {
      val ? this.setAttribute('active', '') : this.removeAttribute('active');
    });
  }
}

ModalWin.template = /*html*/ `
<div dialog-el>
  <div heading-el>
    <div caption-el sub="textContent: caption" app="textContent: modalCaption"></div>
    <button close-btn sub="onclick: closeClicked"></button>
  </div>
  <div content-el ref="content-el"></div>
</div>
`;
