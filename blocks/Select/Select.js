import { Block, BaseComponent } from '../../abstract/Block.js';

export class Option extends BaseComponent {
  initCallback() {
    this.outerHTML = /*html*/ `<option value="${this.$.value}">${this.$.text}</option>`;
  }
}
Option.reg('lr-option');

export class Select extends Block {
  init$ = {
    ...this.init$,
    currentText: '',
    options: [],
  };

  initCallback() {
    super.initCallback();

    this.sub('options', (options) => {
      this.$.currentText = options?.[0]?.text || '';
    });

    /** @type {HTMLSelectElement} */
    let select = this.ref.select;
    select.addEventListener(
      'change',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.value = this.ref.select.value;
        this.$.currentText =
          this.$.options.find((opt) => {
            return opt.value == this.value;
          })?.text || '';
        this.dispatchEvent(new Event('change'));
      },
      false
    );
  }
}

Select.template = /*html*/ `
<button>
  {{currentText}}
  <lr-icon name="select"></lr-icon>
  <select 
    ref="select"
    repeat="options"
    repeat-item-tag="lr-option">
  </select>
</button>
`;
