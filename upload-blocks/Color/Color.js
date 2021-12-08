import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class Color extends BlockComponent {
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
