import { AppComponent } from '../../AppComponent.js';
import { applyElementStyles } from '../../../../symbiote/core/css_utils.js';
import { ResizeObserver } from '../../lib/ResizeObserver.js';

const STYLES = {
  ':host': {
    '--l-thumb-size': '24px',
    '--l-zero-dot-size': '5px',
    '--l-zero-dot-offset': '2px',
    '--idle-color-rgb': 'var(--rgb-text-base)',
    '--hover-color-rgb': 'var(--rgb-primary-accent)',
    '--down-color-rgb': 'var(--rgb-primary-accent)',
    '--color-effect': 'var(--idle-color-rgb)',
    '--l-color': 'rgb(var(--color-effect))',
    width: '100%',
    height: 'calc(var(--l-thumb-size) + (var(--l-zero-dot-size) + var(--l-zero-dot-offset)) * 2)',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    left: '0px',
    width: 'var(--l-thumb-size)',
    height: 'var(--l-thumb-size)',
    backgroundColor: 'var(--l-color)',
    borderRadius: '50%',
    transform: 'translateX(0px)',
    opacity: 1,
    transition: 'opacity var(--transition-duration-2)',
  },
  steps: {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    justifyContent: 'space-between',
    paddingLeft: 'calc(var(--l-thumb-size) / 2)',
    paddingRight: 'calc(var(--l-thumb-size) / 2)',
  },
  'border-step': {
    height: '10px',
    width: '0px',
    borderRight: '1px solid var(--l-color)',
    opacity: '0.6',
    transition: 'var(--transition-duration-2)',
  },
  'minor-step': {
    height: '4px',
    width: '0px',
    borderRight: '1px solid var(--l-color)',
    opacity: '0.2',
    transition: 'var(--transition-duration-2)',
  },
  'zero-dot': {
    height: 'var(--l-zero-dot-size)',
    width: 'var(--l-zero-dot-size)',
    backgroundColor: 'var(--color-primary-accent)',
    borderRadius: '50%',
    position: 'absolute',
    left: 'calc(var(--l-thumb-size) / 2 - var(--l-zero-dot-size) / 2)',
    top: 'calc(100% - var(--l-zero-dot-offset) * 2)',
    opacity: '0',
    transition: 'var(--transition-duration-3)',
  },
  input: {
    cursor: 'pointer',
    position: 'absolute',
    width: 'calc(100% - 10px)',
    height: '100%',
    margin: 0,
    opacity: 0,
  },
};

export class SliderUi extends AppComponent {
  constructor() {
    super();
    this.setAttribute('with-effects', '');
    this.state = {
      disabled: false,
      min: 0,
      max: 100,
      onInput: null,
      onChange: null,
      defaultValue: null,
      'on.sliderInput': () => {
        let value = parseInt(this['input-el'].value, 10);
        this._updateValue(value);
        this.state.onInput && this.state.onInput(value);
      },
      'on.sliderChange': () => {
        let value = parseInt(this['input-el'].value, 10);
        this.state.onChange && this.state.onChange(value);
      },
    };
  }

  readyCallback() {
    super.readyCallback();

    this.defineAccessor('disabled', (disabled) => {
      this.state.disabled = disabled;
    });

    this.defineAccessor('min', (min) => {
      this.state.min = min;
    });

    this.defineAccessor('max', (max) => {
      this.state.max = max;
    });

    this.defineAccessor('defaultValue', (defaultValue) => {
      this.state.defaultValue = defaultValue;
      this['input-el'].value = defaultValue;
      this._updateValue(defaultValue);
    });

    this.defineAccessor('zero', (zero) => {
      this._zero = zero;
    });

    this.defineAccessor('onInput', (onInput) => {
      if (!onInput) return;
      this.state.onInput = onInput;
    });

    this.defineAccessor('onChange', (onChange) => {
      if (!onChange) return;
      this.state.onChange = onChange;
    });
  }

  _updateValue(value) {
    this._updateZeroDot(value);

    let { width } = this.getBoundingClientRect();
    let slope = 100 / (this.state.max - this.state.min);
    let mappedValue = slope * (value - this.state.min);
    let offset = (mappedValue * (width - this._thumbSize)) / 100;
    window.requestAnimationFrame(() => {
      this['thumb-el'].style.transform = `translateX(${offset}px)`;
    });
  }

  _updateZeroDot(value) {
    if (!this._zeroDotEl) {
      return;
    }
    if (value === this._zero) {
      this._zeroDotEl.style.opacity = '0';
    } else {
      this._zeroDotEl.style.opacity = '0.2';
    }
    let { width } = this.getBoundingClientRect();
    let slope = 100 / (this.state.max - this.state.min);
    let mappedValue = slope * (this._zero - this.state.min);
    let offset = (mappedValue * (width - this._thumbSize)) / 100;
    window.requestAnimationFrame(() => {
      this._zeroDotEl.style.transform = `translateX(${offset}px)`;
    });
  }

  _updateSteps() {
    const STEP_GAP = 15;

    let stepsEl = this['steps-el'];
    let { width } = stepsEl.getBoundingClientRect();
    let half = Math.ceil(width / 2);
    let count = Math.ceil(half / STEP_GAP) - 2;

    if (this._stepsCount === count) {
      return;
    }

    let fr = document.createDocumentFragment();
    let minorStepEl = document.createElement('div');
    let borderStepEl = document.createElement('div');
    applyElementStyles(minorStepEl, STYLES['minor-step']);
    applyElementStyles(borderStepEl, STYLES['border-step']);
    fr.appendChild(borderStepEl);
    for (let i = 0; i < count; i++) {
      fr.appendChild(minorStepEl.cloneNode());
    }
    fr.appendChild(borderStepEl.cloneNode());
    for (let i = 0; i < count; i++) {
      fr.appendChild(minorStepEl.cloneNode());
    }
    fr.appendChild(borderStepEl.cloneNode());

    let zeroDotEl = document.createElement('div');
    applyElementStyles(zeroDotEl, STYLES['zero-dot']);
    fr.appendChild(zeroDotEl);
    this._zeroDotEl = zeroDotEl;

    stepsEl.innerHTML = '';
    stepsEl.appendChild(fr);
    this._stepsCount = count;
  }

  connectedCallback() {
    super.connectedCallback();

    this._updateSteps();

    this._observer = new ResizeObserver(() => {
      this._updateSteps();
      let value = parseInt(this['input-el'].value, 10);
      this._updateValue(value);
    });
    this._observer.observe(this);

    this._thumbSize = parseInt(this.style.getPropertyValue('--l-thumb-size'), 10);

    setTimeout(() => {
      let value = parseInt(this['input-el'].value, 10);
      this._updateValue(value);
    }, 0);

    this.sub('disabled', (disabled) => {
      let el = this['input-el'];
      if (disabled) {
        el.setAttribute('disabled', 'disabled');
      } else {
        el.removeAttribute('disabled');
      }
    });

    let inputEl = this.ref('input-el');
    inputEl.addEventListener('focus', () => {
      this.style.setProperty('--color-effect', 'var(--hover-color-rgb)');
    });
    inputEl.addEventListener('blur', () => {
      this.style.setProperty('--color-effect', 'var(--idle-color-rgb)');
    });
  }

  disconnectedCallback() {
    this._observer.unobserve(this);
    this._observer = undefined;
  }
}
SliderUi.styles = STYLES;
SliderUi.template = /*html*/ `
  <div css="steps" ref="steps-el">
  </div>
  <div ref="thumb-el" css="thumb"></div>
  <input css="input" type='range' ref='input-el' tabindex="0" set="oninput: on.sliderInput; onchange: on.sliderChange; @min: min; @max: max; @value: defaultValue;">
`;
