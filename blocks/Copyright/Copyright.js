import { Block } from '../../abstract/Block.js';

export class Copyright extends Block {
  cssInit$ = {
    ...this.cssInit$,
    '--cfg-remove-copyright': 0,
  };

  init$ = {
    ...this.init$,
    removeCopyright: false,
  };

  initCallback() {
    super.initCallback();

    this.sub(
      '--cfg-remove-copyright',
      /** @param {number} value */
      (value) => {
        this.$.removeCopyright = !!value;
      }
    );
  }

  static template = /* HTML */ `
    <a
      href="https://uploadcare.com/?utm_source=copyright&utm_medium=referral&utm_campaign=v4"
      target="_blank noopener"
      class="credits"
      set="@hidden: removeCopyright"
      >Powered by Uploadcare</a
    >
  `;
}
