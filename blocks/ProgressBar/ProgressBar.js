import { Block } from '../../abstract/Block.js';

export class ProgressBar extends Block {
  /** @type {Number} */
  _value = 0;

  /** @type {Boolean} */
  _visible = true;

  init$ = {
    ...this.init$,
    width: 0,
    opacity: 0,
  };

  initCallback() {
    super.initCallback();
    this.defineAccessor('value', (value) => {
      if (value === undefined || value === null) return;
      const prevValue = this._value;
      this._value = value;
      if (!this._visible) return;
      if (value === 100) {
        this.ref.realProgressLine.addEventListener(
          'transitionend',
          () => {
            this.ref.realProgressLine.classList.toggle('uc-progress--hidden', true);
          },
          {
            once: true,
          },
        );
      }

      this.ref.fakeProgressLine.classList.toggle('uc-fake-progress--hidden', value !== 0);

      if (value === 0 && prevValue > 0) {
        this.ref.realProgressLine.addEventListener(
          'transitionend',
          () => {
            this.style.setProperty('--l-progress-value', this._value.toString());
          },
          {
            once: true,
          },
        );
        return;
      }

      this.style.setProperty('--l-progress-value', this._value.toString());
    });

    this.defineAccessor('visible', (visible) => {
      this._visible = visible;

      this.ref.realProgressLine.classList.toggle('uc-progress--hidden', !visible);
      this.ref.fakeProgressLine.classList.toggle('uc-fake-progress--hidden', !visible);
    });
  }
}

ProgressBar.template = /* HTML */ `
  <div ref="fakeProgressLine" class="uc-fake-progress"></div>
  <div ref="realProgressLine" class="uc-progress"></div>
`;
