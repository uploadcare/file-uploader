import { ImgBase } from './ImgBase.js';

export class Img extends ImgBase {
  initCallback() {
    super.initCallback();

    this.sub$$('src', () => {
      this.init();
    });

    this.sub$$('uuid', () => {
      this.init();
    });

    this.sub$$('lazy', (val) => {
      this.img.loading = val ? 'lazy' : 'eager';
    });
  }
}
