import { Block } from '../../abstract/Block.js';
import { checkerboardCssBg } from '../svg-backgrounds/svg-backgrounds.js';
import { TRANSPARENT_PIXEL_SRC } from '../../utils/transparentPixelSrc.js';

export class FilePreview extends Block {
  init$ = {
    ...this.init$,
    checkerboard: false,
    src: TRANSPARENT_PIXEL_SRC,
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
    this.$.src = img.src;
  }

  /** @param {File} imgFile */
  setImageFile(imgFile) {
    let url = URL.createObjectURL(imgFile);
    this.$.src = url;
    this._lastObjectUrl = url;
  }

  /** @param {String} url */
  setImageUrl(url) {
    this.$.src = url;
  }

  clear() {
    URL.revokeObjectURL(this._lastObjectUrl);
    this.$.src = TRANSPARENT_PIXEL_SRC;
  }
}

FilePreview.template = /* HTML */ ` <lr-img class="img-view" ref="img" set="@src: src; style.aa: src;" /> `;

FilePreview.bindAttributes({
  checkerboard: 'checkerboard',
});
