import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class ProgressBar extends BlockComponent {
  /** @type {number} */
  _value = 0;
  /** @type {boolean} */
  _unknownMode = false;

  init$ = {
    width: 0,
    opacity: 0,
  };

  initCallback() {
    this.defineAccessor('value', (value) => {
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

ProgressBar.template = /*html*/ `
<div
  ref="line"
  class="progress">
</div>
`;
