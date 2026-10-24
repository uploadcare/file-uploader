import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { LightDomMixin } from '../../../lit/LightDomMixin';
import { RegisterableElementMixin } from '../../../lit/RegisterableElementMixin';

const X_THRESHOLD = 1;
const noopScrollListener = () => {};

// Pure UI element (M12 step 2b): no editor-controller/ctx/l10n access (verified
// by grepping the original `LitBlock`-based implementation for `this.$`/
// `this.sub`/`this.cfg`/`this.l10n` — none found), so this is plain Lit rather
// than `EditorBlock` — no reason to pull in the editor context machinery.
const EditorScrollerBase = RegisterableElementMixin(LightDomMixin(LitElement));

export class EditorScroller extends EditorScrollerBase {
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

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-scroller': EditorScroller;
  }
}
