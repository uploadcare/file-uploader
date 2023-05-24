import { Block } from '../../abstract/Block.js';

export class ProgressBar extends Block {
  /** @type {Number} */
  _value = 0;
  /** @type {Boolean} */
  _unknownMode = false;

  init$ = {
    ...this.init$,
    width: 0,
    opacity: 0,
  };

  initCallback() {
    super.initCallback();
    this.defineAccessor('value', (value) => {
      if (value === undefined) {
        return;
      }
      this._value = value;

      if (!this._unknownMode) {
        this.style.setProperty('--l-width', this._value.toString());
      }
    });
    this.defineAccessor('visible', (visible) => {
      this.ref.line.classList.toggle('progress--hidden', !visible);
    });
    this.defineAccessor('unknown', (unknown) => {
      this._unknownMode = unknown;
      this.ref.line.classList.toggle('progress--unknown', unknown);
    });
  }
}

ProgressBar.template = /* HTML */ ` <div ref="line" class="progress"></div> `;
