import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { EditorToolbar } from './EditorToolbar.js';
import { applyStyles } from '../../symbiote/utils/dom-helpers.js';

export class EditableCanvas extends BlockComponent {
  constructor() {
    super();
    this.pauseRender = true;
    applyStyles(this, {
      position: 'relative',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    });
  }

  initCallback() {
    this.canvas = this.querySelector('canvas');
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.appendChild(this.canvas);
    }
    this.canvCtx = this.canvas.getContext('2d');
    this.canvParent = this.canvas.parentElement;
    this.toolbar = new EditorToolbar();
    this.toolbar.canvas = this.canvas;
    this.toolbar.editor = this;
    this.canvParent.appendChild(this.toolbar);
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
}
