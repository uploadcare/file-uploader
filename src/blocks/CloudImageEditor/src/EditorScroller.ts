import { LitBlock } from '../../../lit/LitBlock';

const X_THRESHOLD = 1;
const noopScrollListener = () => {};

export class EditorScroller extends LitBlock {
  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const { deltaY, deltaX } = event;
    if (Math.abs(deltaX) > X_THRESHOLD) {
      this.scrollLeft += deltaX;
      return;
    }
    this.scrollLeft += deltaY;
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('wheel', this.handleWheel, { passive: false });
    // This fixes a macOS issue where wheel events skip without an attached scroll listener
    this.addEventListener('scroll', noopScrollListener, { passive: true });
  }

  override disconnectedCallback(): void {
    this.removeEventListener('wheel', this.handleWheel);
    this.removeEventListener('scroll', noopScrollListener);
    super.disconnectedCallback();
  }
}
