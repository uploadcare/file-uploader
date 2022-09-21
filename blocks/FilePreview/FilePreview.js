import { Block } from '../../abstract/Block.js';
import { checkerboardCssBg } from '../svg-backgrounds/svg-backgrounds.js';
import { TRANSPARENT_PIXEL_SRC } from '../../utils/transparentPixelSrc.js';

export class FilePreview extends Block {
  init$ = {
    ...this.ctxInit,
    checkerboard: false,
  };

  constructor() {
    super();
  }

  initCallback() {
    super.initCallback();
    this.sub('checkerboard', () => {
      this.style.backgroundImage = this.hasAttribute('checkerboard') ? `url(${checkerboardCssBg()})` : 'unset';
    });
  }

  destroyCallback() {
    super.destroyCallback();
    URL.revokeObjectURL(this._lastObjectUrl);
  }

  /** @param {HTMLImageElement} img */
  setImage(img) {
    this.ref.img.src = img.src;
  }

  /** @param {File} imgFile */
  setImageFile(imgFile) {
    let url = URL.createObjectURL(imgFile);
    this.ref.img.src = url;
    this._lastObjectUrl = url;
  }

  /** @param {String} url */
  setImageUrl(url) {
    this.ref.img.src = url;
  }

  clear() {
    URL.revokeObjectURL(this._lastObjectUrl);
    this.ref.img.src = TRANSPARENT_PIXEL_SRC;
  }
}

FilePreview.template = /*html*/ `
<img class="img-view" ref="img"/>
`;

FilePreview.bindAttributes({
  checkerboard: 'checkerboard',
});
