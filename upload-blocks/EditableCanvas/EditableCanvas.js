import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { EditorToolbar } from './EditorToolbar.js';
import { applyStyles } from '../../node_modules/@symbiotejs/symbiote/build/symbiote.js';
import { checkerboardCssBg } from '../svg-backgrounds/svg-backgrounds.js';

EditorToolbar.reg('editor-toolbar');

export class EditableCanvas extends BlockComponent {
  init$ = {
    refMap: null,
    disabled: true,
    toolbarHidden: true,
    checkerboard: false,
  };

  constructor() {
    super();
    applyStyles(this, {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    });
  }

  initCallback() {
    this.sub('disabled', () => {
      this.$.toolbarHidden = this.hasAttribute('disabled') && this.getAttribute('disabled') !== 'false';
    });
    this.sub('checkerboard', () => {
      this.style.backgroundImage = this.hasAttribute('checkerboard') ? `url(${checkerboardCssBg()})` : 'unset';
    });
    /** @type {HTMLCanvasElement} */
    // @ts-ignore
    this.canvas = this.ref.cvs;
    this.canvCtx = this.canvas.getContext('2d');
    this.$.refMap = {
      parent: this,
      canvas: this.canvas,
      canvCtx: this.canvCtx,
      svg: this.ref.svg,
      svgGroup: this.ref.svg_g,
      svgImg: this.ref.svg_img,
    };
  }

  /** @param {HTMLImageElement} img */
  setImage(img) {
    if (img.height && img.width) {
      this.canvas.height = img.height;
      this.canvas.width = img.width;
      this.canvCtx.drawImage(img, 0, 0, img.width, img.height);
    } else {
      img.onload = () => {
        this.canvas.height = img.height;
        this.canvas.width = img.width;
        this.canvCtx.drawImage(img, 0, 0, img.width, img.height);
      };
    }
  }

  /** @param {File} imgFile */
  setImageFile(imgFile) {
    let img = new Image();
    let url = URL.createObjectURL(imgFile);
    img.src = url;
    this.setImage(img);
  }

  /** @param {String} url */
  setImageUrl(url) {
    let img = new Image();
    img.src = url;
    this.setImage(img);
  }

  clear() {
    this.canvCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

EditableCanvas.template = /*html*/ `
<canvas class="img-view" ref="cvs"></canvas>
<svg class="img-view" xmlns="http://www.w3.org/2000/svg" ref="svg">
  <g ref="svg_g">
    <image ref="svg_img" x="0" y="0"></image>
  </g>
</svg>
<uc-editor-toolbar
  set="refMap: refMap; @hidden: toolbarHidden">
</uc-editor-toolbar>
`;

EditableCanvas.bindAttributes({
  disabled: 'disabled',
  checkerboard: 'checkerboard',
});
