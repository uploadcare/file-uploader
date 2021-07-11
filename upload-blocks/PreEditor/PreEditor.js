import { AppComponent } from '../AppComponent/AppComponent.js';

export class PreEditor extends AppComponent {

  constructor() {
    super();
    this.initLocalState({
      'on.back': () => {

      },
      'on.edit': () => {

      },
    });
  }

  connectedCallback() {
    this.addToAppState({
      focusedFile: null,
    });
    super.connectedCallback();
    this.appState.sub('focusedFile', (file) => {
      if (!file) {
        return;
      }
      /** @type {HTMLCanvasElement} */
      // @ts-ignore
      this._canv = this.ref.canvas;
      this._ctx = this._canv.getContext('2d');
      let img = new Image();
      let url = URL.createObjectURL(file);
      img.onload = () => {
        this._canv.height = img.height;
        this._canv.width = img.width;
        this._ctx.drawImage(img, 0, 0);
      };
      img.src = url;
    });
  }

}

PreEditor.template = /*html*/ `
<canvas ref="canvas"></canvas>
<div -toolbar->
  <button -back-btn- sub="onclick: on.back"></button>
  <button -edit-btn- sub="onclick: on.edit"></button>
</div>
`;

