import { ImgBase } from './ImgBase.js';

export class Img extends ImgBase {
  public override connectedCallback(): void {
    super.connectedCallback();

    this.sub$$('src', () => {
      this.init();
    });

    this.sub$$('uuid', () => {
      this.init();
    });

    this.sub$$<string | number | boolean>('lazy', (val) => {
      if (!this.$$('is-background-for') && !this.$$('is-preview-blur')) {
        this.img.loading = val ? 'lazy' : 'eager';
      }
    });
  }
}
