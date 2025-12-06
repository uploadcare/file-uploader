import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { LitBlock } from '../../../../../lit/LitBlock';

export class LineLoaderUi extends LitBlock {
  @property({ type: Boolean, reflect: true })
  public active = false;

  private readonly lineRef = createRef<HTMLDivElement>();
  private _isAnimating = false;

  private readonly handleTransitionEndRight = (): void => {
    const lineEl = this.lineRef.value;
    if (!lineEl) {
      return;
    }
    this.resetLine(lineEl);
    if (this._isAnimating && this.active) {
      this.start();
    }
  };

  protected override firstUpdated(_changedProperties: PropertyValues<this>): void {
    super.firstUpdated(_changedProperties);
    if (this.active) {
      this.start();
    }
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (changedProperties.has('active')) {
      if (this.active) {
        this.start();
      } else {
        this.stop();
      }
    }
  }

  private start(): void {
    const lineEl = this.lineRef.value;
    if (!lineEl) {
      return;
    }
    this._isAnimating = true;
    const { width } = this.getBoundingClientRect();
    lineEl.removeEventListener('transitionend', this.handleTransitionEndRight);
    lineEl.style.transition = 'transform 1s';
    lineEl.style.opacity = '1';
    lineEl.style.transform = `translateX(${width}px)`;
    lineEl.addEventListener('transitionend', this.handleTransitionEndRight, {
      once: true,
    });
  }

  private stop(): void {
    const lineEl = this.lineRef.value;
    if (!lineEl) {
      return;
    }
    this._isAnimating = false;
    lineEl.removeEventListener('transitionend', this.handleTransitionEndRight);
    this.resetLine(lineEl);
  }

  private resetLine(lineEl: HTMLDivElement): void {
    lineEl.style.transition = 'initial';
    lineEl.style.opacity = '0';
    lineEl.style.transform = 'translateX(-101%)';
  }

  public override render() {
    return html`
      <div class="uc-inner">
        <div class="uc-line" ${ref(this.lineRef)}></div>
      </div>
    `;
  }
}
