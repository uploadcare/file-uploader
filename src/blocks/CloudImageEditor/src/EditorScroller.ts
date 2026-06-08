import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { LightDomMixin } from '../../../lit/LightDomMixin';

const X_THRESHOLD = 1;
const noopScrollListener = () => {};

export class EditorScroller extends LightDomMixin(LitElement) {
  /**
   * CSS-only attribute
   */
  @property({ type: Boolean, noAccessor: true, attribute: 'hidden-scrollbar' })
  public hiddenScrollbar = false;

  private readonly _handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const { deltaY, deltaX } = event;
    if (Math.abs(deltaX) > X_THRESHOLD) {
      this.scrollLeft += deltaX;
      return;
    }
    this.scrollLeft += deltaY;
  };

  public override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('wheel', this._handleWheel, { passive: false });
    // This fixes a macOS issue where wheel events skip without an attached scroll listener
    this.addEventListener('scroll', noopScrollListener, { passive: true });
  }

  public override disconnectedCallback(): void {
    this.removeEventListener('wheel', this._handleWheel);
    this.removeEventListener('scroll', noopScrollListener);
    super.disconnectedCallback();
  }
}

if (!customElements.get('uc-editor-scroller')) {
  customElements.define('uc-editor-scroller', EditorScroller);
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-scroller': EditorScroller;
  }
}
