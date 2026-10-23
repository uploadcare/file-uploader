import { html, LitElement, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { LightDomMixin } from '../../../../../lit/LightDomMixin';
import { RegisterableElementMixin } from '../../../../../lit/RegisterableElementMixin';

// Pure presentational leaf: no editor-state/l10n/ctx dependency, so it needs
// neither `ChildBlock` nor `EditorBlock` — just the two structural mixins
// (light-DOM rendering + `reg()` registration), same base shape as
// `ChildBlockBase`/`EditorBlockBase`.
const SliderUiBase = RegisterableElementMixin(LightDomMixin(LitElement));

const STEP_GAP = 15;

export class SliderUi extends SliderUiBase {
  private _observer?: ResizeObserver;
  private readonly _inputRef = createRef<HTMLInputElement>();
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

  /** Accessible name of the range input (the operation it adjusts). */
  @property({ attribute: false })
  public label = '';

  @state()
  private _currentValue = 0;

  // Minor ticks on each side of the middle one, from the measured width.
  @state()
  private _stepsCount = 0;

  private _emitSliderEvent(type: 'uc-internal:slider-input', value: number): void {
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
    this._emitSliderEvent('uc-internal:slider-input', value);
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

    this._syncInputValue(this._currentValue);

    // Also reports the first size, so it sets the first tick count too.
    this._observer = new ResizeObserver(() => this._updateSteps());
    this._observer.observe(this);
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has('defaultValue') && this.defaultValue !== this._currentValue) {
      this._setCurrentValue(this.defaultValue);
    }
  }

  private _updateSteps(): void {
    const stepsEl = this._stepsRef.value;
    if (stepsEl) {
      this._stepsCount = Math.max(0, Math.ceil(Math.ceil(stepsEl.getBoundingClientRect().width / 2) / STEP_GAP) - 2);
    }
  }

  /** Where `value` sits between `min` and `max`, from 0 to 1. The CSS turns it into a position. */
  private _fraction(value: number): number {
    const range = this.max - this.min;
    return range === 0 ? 0 : (value - this.min) / range;
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    // Not in the constructor: an element created by `document.createElement` must not have attributes yet.
    if (!this.hasAttribute('with-effects')) this.setAttribute('with-effects', '');
    // Created in `firstUpdated`; a reconnect (DOM move) re-observes what `disconnectedCallback` disconnected.
    this._observer?.observe(this);
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._observer?.disconnect();
  }

  private _setCurrentValue(value: number): void {
    if (!Number.isFinite(value)) {
      return;
    }
    this._currentValue = value;
    if (this.hasUpdated) {
      this._syncInputValue(value);
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

  private _renderMinorSteps() {
    return Array.from({ length: this._stepsCount }, () => html`<div class="uc-minor-step"></div>`);
  }

  public override render() {
    return html`
      <div class="uc-steps" ${ref(this._stepsRef)}>
        <div class="uc-border-step"></div>
        ${this._renderMinorSteps()}
        <div class="uc-border-step"></div>
        ${this._renderMinorSteps()}
        <div class="uc-border-step"></div>
        <div
          class="uc-zero-dot"
          style="--l-fraction: ${this._fraction(this.zero)}; opacity: ${this._currentValue === this.zero ? 0 : 1}"
        ></div>
      </div>
      <div class="uc-thumb" style="--l-fraction: ${this._fraction(this._currentValue)}"></div>
      <input
        class="uc-input"
        type="range"
        aria-label=${ifDefined(this.label || undefined)}
        ${ref(this._inputRef)}
        .min=${String(this.min)}
        .max=${String(this.max)}
        .value=${String(this._currentValue)}
        ?disabled=${this.disabled}
        @input=${this._handleSliderInput}
        @change=${this._handleSliderChange}
        @focus=${this._handleInputFocus}
        @blur=${this._handleInputBlur}
      />
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-slider-ui': SliderUi;
  }
}
