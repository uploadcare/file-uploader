import { Block } from '../../abstract/Block.js';

/** @typedef {{ '*selectedColor': String; inputOpacity: Number; onChange: () => void }} State */

/** @extends {Block<State>} */
export class Color extends Block {
  /** @type {State} */
  init$ = {
    inputOpacity: 0,
    '*selectedColor': '#f00',
    onChange: () => {
      this.$['*selectedColor'] = this.ref.input['value'];
    },
  };
}

Color.template = /*html*/ `
<input
  ref="input"
  type="color"
  set="oninput: onChange; style.opacity: inputOpacity">
<div
  class="current-color"
  set="style.backgroundColor: *selectedColor">
</div>
`;
