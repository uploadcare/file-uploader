import { Block } from '../../abstract/Block.js';

export class Copyright extends Block {
  static template = /* HTML */ `
    <a href="https://uploadcare.com/" target="_blank" class="credits">Powered by Uploadcare</a>
  `;
}
