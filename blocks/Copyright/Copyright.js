import { Block } from '../../abstract/Block.js';

export class Copyright extends Block {
  static template = /* HTML */ `
    <a
      href="https://uploadcare.com/?utm_source=copyright&utm_medium=referral&utm_campaign=v4"
      target="_blank noopener"
      class="credits"
      >Powered by Uploadcare</a
    >
  `;
}
