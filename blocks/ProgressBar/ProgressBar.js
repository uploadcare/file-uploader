// @ts-check
import { Block } from '../../abstract/Block.js';

export class ProgressBar extends Block {
  /** @type {Number} */
  _value = 0;

  /** @type {Number} */
  _prevValue = 0;

  /** @type {Boolean} */
  _visible = true;

  constructor() {
    super();
    this.init$ = {
      ...this.init$,
      width: 0,
      opacity: 0,
    };
  }

  initCallback() {
    super.initCallback();

    this.ref.fakeProgressLine.addEventListener('animationiteration', () => {
      if (this._value === 0) return;
      this.ref.fakeProgressLine.classList.toggle('uc-fake-progress--hidden', true);
    });

    this.ref.realProgressLine.addEventListener('transitionend', () => {
      if (this._value === 100) {
        this.classList.add('uc-progress-bar--hidden');
        this.ref.realProgressLine.classList.toggle('uc-progress--hidden', true);
      }
      if (this._value === 0 && this._prevValue > 0) {
        this.style.setProperty('--l-progress-value', this._value.toString());
      }
    });

    this.defineAccessor(
      'value',
      /** @param {number} value */ (value) => {
        if (value === undefined || value === null) return;
        this._prevValue = this._value;
        this._value = value;

        if (!this._visible) return;
        this.style.setProperty('--l-progress-value', this._value.toString());
      },
    );

    this.defineAccessor(
      'visible',
      /** @param {boolean} visible */ (visible) => {
        this._visible = visible;

        this.classList.toggle('uc-progress-bar--hidden', !visible);
        this.ref.realProgressLine.classList.toggle('uc-progress--hidden', !visible);
        this.ref.fakeProgressLine.classList.toggle('uc-fake-progress--hidden', !visible);
      },
    );
  }
}

ProgressBar.template = /* HTML */ `
  <div ref="fakeProgressLine" class="uc-fake-progress"></div>
  <div ref="realProgressLine" class="uc-progress"></div>
`;
