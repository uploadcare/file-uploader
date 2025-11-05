import { html } from '@symbiotejs/symbiote';
import { Block } from '../../../../../abstract/Block';

type SliderHandler = (value: number) => void;

export class SliderUi extends Block {
  private _observer?: ResizeObserver;
  private _thumbSize = 0;
  private _zero = 0;
  private _zeroDotEl?: HTMLDivElement;
  private _stepsCount?: number;

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      disabled: false,
      min: 0,
      max: 100,
      onInput: null as SliderHandler | null,
      onChange: null as SliderHandler | null,
      defaultValue: 0,
      'on.sliderInput': () => {
        const value = Number.parseInt(this._inputEl().value, 10);
        this._updateValue(value);
        this.$.onInput?.(value);
      },
      'on.sliderChange': () => {
        const value = Number.parseInt(this._inputEl().value, 10);
        this.$.onChange?.(value);
      },
    };

    this.setAttribute('with-effects', '');
  }

  override initCallback(): void {
    super.initCallback();

    this.defineAccessor('disabled', (disabled: boolean) => {
      this.$.disabled = disabled;
    });

    this.defineAccessor('min', (min: number) => {
      this.$.min = min;
    });

    this.defineAccessor('max', (max: number) => {
      this.$.max = max;
    });

    this.defineAccessor('defaultValue', (defaultValue: number) => {
      this.$.defaultValue = defaultValue;
      const inputEl = this._inputEl();
      inputEl.value = String(defaultValue);
      this._updateValue(defaultValue);
    });

    this.defineAccessor('zero', (zero: number) => {
      this._zero = zero;
    });

    this.defineAccessor('onInput', (onInput: SliderHandler | null) => {
      if (!onInput) {
        return;
      }
      this.$.onInput = onInput;
    });

    this.defineAccessor('onChange', (onChange: SliderHandler | null) => {
      if (!onChange) {
        return;
      }
      this.$.onChange = onChange;
    });

    this._updateSteps();

    this._observer = new ResizeObserver(() => {
      this._updateSteps();
      const value = Number.parseInt(this._inputEl().value, 10);
      this._updateValue(value);
    });
    this._observer.observe(this);

    this._thumbSize = Number.parseInt(window.getComputedStyle(this).getPropertyValue('--l-thumb-size'), 10);

    setTimeout(() => {
      const value = Number.parseInt(this._inputEl().value, 10);
      this._updateValue(value);
    }, 0);

    this.sub('disabled', (disabled: boolean) => {
      const el = this._inputEl();
      if (disabled) {
        el.setAttribute('disabled', 'disabled');
      } else {
        el.removeAttribute('disabled');
      }
    });

    const inputEl = this._inputEl();
    inputEl.addEventListener('focus', () => {
      this.style.setProperty('--color-effect', 'var(--hover-color-rgb)');
    });
    inputEl.addEventListener('blur', () => {
      this.style.setProperty('--color-effect', 'var(--idle-color-rgb)');
    });
  }

  private _inputEl(): HTMLInputElement {
    return this.ref['input-el'] as HTMLInputElement;
  }

  private _thumbEl(): HTMLElement {
    return this.ref['thumb-el'] as HTMLElement;
  }

  private _stepsEl(): HTMLElement {
    return this.ref['steps-el'] as HTMLElement;
  }

  private _updateValue(value: number): void {
    this._updateZeroDot(value);

    const { width } = this.getBoundingClientRect();
    const slope = 100 / (this.$.max - this.$.min);
    const mappedValue = slope * (value - this.$.min);
    const offset = (mappedValue * (width - this._thumbSize)) / 100;

    window.requestAnimationFrame(() => {
      this._thumbEl().style.transform = `translateX(${offset}px)`;
    });
  }

  private _updateZeroDot(value: number): void {
    if (!this._zeroDotEl) {
      return;
    }
    this._zeroDotEl.style.opacity = value === this._zero ? '0' : '1';
    const { width } = this.getBoundingClientRect();
    const slope = 100 / (this.$.max - this.$.min);
    const mappedValue = slope * (this._zero - this.$.min);
    const offset = (mappedValue * (width - this._thumbSize)) / 100;
    window.requestAnimationFrame(() => {
      if (this._zeroDotEl) {
        this._zeroDotEl.style.transform = `translateX(${offset}px)`;
      }
    });
  }

  private _updateSteps(): void {
    const STEP_GAP = 15;

    const stepsEl = this._stepsEl();
    const { width } = stepsEl.getBoundingClientRect();
    const half = Math.ceil(width / 2);
    const count = Math.ceil(half / STEP_GAP) - 2;

    if (this._stepsCount === count) {
      return;
    }

    const fragment = document.createDocumentFragment();
    const minorStepEl = document.createElement('div');
    const borderStepEl = document.createElement('div');
    minorStepEl.className = 'uc-minor-step';
    borderStepEl.className = 'uc-border-step';
    fragment.appendChild(borderStepEl);
    for (let i = 0; i < count; i += 1) {
      fragment.appendChild(minorStepEl.cloneNode());
    }
    fragment.appendChild(borderStepEl.cloneNode());
    for (let i = 0; i < count; i += 1) {
      fragment.appendChild(minorStepEl.cloneNode());
    }
    fragment.appendChild(borderStepEl.cloneNode());

    const zeroDotEl = document.createElement('div');
    zeroDotEl.className = 'uc-zero-dot';
    fragment.appendChild(zeroDotEl);
    this._zeroDotEl = zeroDotEl;

    stepsEl.innerHTML = '';
    stepsEl.appendChild(fragment);
    this._stepsCount = count;
  }

  override destroyCallback(): void {
    super.destroyCallback();
    this._observer?.disconnect();
  }
}
SliderUi.template = html`
  <div class="uc-steps" ref="steps-el"></div>
  <div ref="thumb-el" class="uc-thumb"></div>
  <input
    class="uc-input"
    type="range"
    ref="input-el"
    bind="oninput: on.sliderInput; onchange: on.sliderChange; @min: min; @max: max; @value: defaultValue;"
  />
`;
