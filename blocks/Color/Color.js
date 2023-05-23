import { Block } from '../../abstract/Block.js';

export class Color extends Block {
  init$ = {
    ...this.init$,
    inputOpacity: 0,
    '*selectedColor': '#f00',
    onChange: () => {
      this.$['*selectedColor'] = this.ref.input['value'];
    },
  };
}

Color.template = /* HTML */ `
  <input ref="input" type="color" set="oninput: onChange; style.opacity: inputOpacity" />
  <div class="current-color" set="style.backgroundColor: *selectedColor"></div>
`;
