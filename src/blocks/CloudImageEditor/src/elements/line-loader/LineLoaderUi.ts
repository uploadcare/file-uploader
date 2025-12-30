import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { LitBlock } from '../../../../../lit/LitBlock';

export class LineLoaderUi extends LitBlock {
  @property({ type: Boolean, reflect: true })
  public active = false;

  private readonly _lineRef = createRef<HTMLDivElement>();
  private _isAnimating = false;

  private readonly _handleTransitionEndRight = (): void => {
    const lineEl = this._lineRef.value;
    if (!lineEl) {
      return;
    }
    this._resetLine(lineEl);
    if (this._isAnimating && this.active) {
      this._start();
    }
  };

  protected override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);
    if (this.active) {
      this._start();
    }
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (changedProperties.has('active')) {
      if (this.active) {
        this._start();
      } else {
        this._stop();
      }
    }
  }

  private _start(): void {
    const lineEl = this._lineRef.value;
    if (!lineEl) {
      return;
    }
    this._isAnimating = true;
    const { width } = this.getBoundingClientRect();
    lineEl.removeEventListener('transitionend', this._handleTransitionEndRight);
    lineEl.style.transition = 'transform 1s';
    lineEl.style.opacity = '1';
    lineEl.style.transform = `translateX(${width}px)`;
    lineEl.addEventListener('transitionend', this._handleTransitionEndRight, {
      once: true,
    });
  }

  private _stop(): void {
    const lineEl = this._lineRef.value;
    if (!lineEl) {
      return;
    }
    this._isAnimating = false;
    lineEl.removeEventListener('transitionend', this._handleTransitionEndRight);
    this._resetLine(lineEl);
  }

  private _resetLine(lineEl: HTMLDivElement): void {
    lineEl.style.transition = 'initial';
    lineEl.style.opacity = '0';
    lineEl.style.transform = 'translateX(-101%)';
  }

  public override render() {
    return html`
      <div class="uc-inner">
        <div class="uc-line" ${ref(this._lineRef)}></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-line-loader-ui': LineLoaderUi;
  }
}
