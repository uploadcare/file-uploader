import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { LitBlock } from '../../../../../lit/LitBlock';

export class SliderUi extends LitBlock {
  private _observer?: ResizeObserver;
  private _thumbSize = 0;
  private _zeroDotEl?: HTMLDivElement;
  private _stepsCount?: number;
  private readonly _inputRef = createRef<HTMLInputElement>();
  private readonly _thumbRef = createRef<HTMLDivElement>();
  private readonly _stepsRef = createRef<HTMLDivElement>();

  @property({ type: Boolean, reflect: true })
  public disabled = false;

  @property({ type: Number })
  public min = 0;

  @property({ type: Number })
  public max = 100;

  @property({ type: Number, attribute: false })
  public defaultValue = 0;

  @property({ type: Number })
  public zero = 0;

  @state()
  private _currentValue = 0;

  public constructor() {
    super();
    this.setAttribute('with-effects', '');
  }

  private _emitSliderEvent(type: 'slider-input', value: number): void {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private readonly _handleSliderInput = (event: Event): void => {
    event.stopPropagation();
    const value = this._extractEventValue(event);
    if (value === null) {
      return;
    }
    this._setCurrentValue(value);
    this._emitSliderEvent('slider-input', value);
  };

  private readonly _handleSliderChange = (event: Event): void => {
    event.stopPropagation();
    const value = this._extractEventValue(event);
    if (value === null) {
      return;
    }
    this._setCurrentValue(value);
  };

  private readonly _handleInputFocus = (): void => {
    this.style.setProperty('--color-effect', 'var(--hover-color-rgb)');
  };

  private readonly _handleInputBlur = (): void => {
    this.style.setProperty('--color-effect', 'var(--idle-color-rgb)');
  };

  protected override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);

    this._thumbSize = Number.parseInt(window.getComputedStyle(this).getPropertyValue('--l-thumb-size'), 10) || 0;
    this._syncInputValue(this._currentValue);
    this._updateSteps();

    this._observer = new ResizeObserver(() => {
      this._updateSteps();
      this._updateValue(this._currentValue);
    });
    this._observer.observe(this);

    const inputEl = this._inputRef.value;
    inputEl?.addEventListener('focus', this._handleInputFocus);
    inputEl?.addEventListener('blur', this._handleInputBlur);

    window.setTimeout(() => {
      this._updateValue(this._currentValue);
    }, 0);
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has('defaultValue') && this.defaultValue !== this._currentValue) {
      this._setCurrentValue(this.defaultValue);
    }

    const boundsChanged = changedProperties.has('min') || changedProperties.has('max');
    if (boundsChanged && this.hasUpdated) {
      this._updateSteps();
      this._updateValue(this._currentValue);
    }

    if (changedProperties.has('zero') && this.hasUpdated) {
      this._updateZeroDot(this._currentValue);
    }
  }

  private _updateValue(value: number): void {
    this._updateZeroDot(value);

    const range = this.max - this.min;
    if (range === 0) {
      return;
    }
    const { width } = this.getBoundingClientRect();
    const slope = 100 / range;
    const mappedValue = slope * (value - this.min);
    const offset = (mappedValue * (width - this._thumbSize)) / 100;

    window.requestAnimationFrame(() => {
      const thumbEl = this._thumbRef.value;
      if (thumbEl) {
        thumbEl.style.transform = `translateX(${offset}px)`;
      }
    });
  }

  private _updateZeroDot(value: number): void {
    if (!this._zeroDotEl) {
      return;
    }
    const range = this.max - this.min;
    if (range === 0) {
      return;
    }
    this._zeroDotEl.style.opacity = value === this.zero ? '0' : '1';
    const { width } = this.getBoundingClientRect();
    const slope = 100 / range;
    const mappedValue = slope * (this.zero - this.min);
    const offset = (mappedValue * (width - this._thumbSize)) / 100;
    window.requestAnimationFrame(() => {
      if (this._zeroDotEl) {
        this._zeroDotEl.style.transform = `translateX(${offset}px)`;
      }
    });
  }

  private _updateSteps(): void {
    const STEP_GAP = 15;
    const stepsEl = this._stepsRef.value;
    if (!stepsEl) {
      return;
    }

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

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    const inputEl = this._inputRef.value;
    inputEl?.removeEventListener('focus', this._handleInputFocus);
    inputEl?.removeEventListener('blur', this._handleInputBlur);
    this._observer?.disconnect();
    this._observer = undefined;
  }

  private _setCurrentValue(value: number): void {
    if (!Number.isFinite(value)) {
      return;
    }
    this._currentValue = value;
    if (this.hasUpdated) {
      this._syncInputValue(value);
      this._updateValue(value);
    }
  }

  private _syncInputValue(value: number): void {
    const inputEl = this._inputRef.value;
    if (inputEl) {
      inputEl.value = String(value);
    }
  }

  private _extractEventValue(event: Event): number | null {
    const target = event.currentTarget as HTMLInputElement | null;
    if (!target) {
      return null;
    }
    const parsedValue = Number.parseInt(target.value, 10);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  public override render() {
    return html`
      <div class="uc-steps" ${ref(this._stepsRef)}></div>
      <div class="uc-thumb" ${ref(this._thumbRef)}></div>
      <input
        class="uc-input"
        type="range"
        ${ref(this._inputRef)}
        .min=${String(this.min)}
        .max=${String(this.max)}
        .value=${String(this._currentValue)}
        ?disabled=${this.disabled}
        @input=${this._handleSliderInput}
        @change=${this._handleSliderChange}
      />
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-slider-ui': SliderUi;
  }
}
