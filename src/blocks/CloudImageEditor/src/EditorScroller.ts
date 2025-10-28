import { Block } from '../../../abstract/Block';

const X_THRESHOLD = 1;

export class EditorScroller extends Block {
  override initCallback(): void {
    super.initCallback();

    this.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();

        const { deltaY, deltaX } = e;
        if (Math.abs(deltaX) > X_THRESHOLD) {
          this.scrollLeft += deltaX;
        } else {
          this.scrollLeft += deltaY;
        }
      },
      {
        passive: false,
      },
    );

    // This fixes some strange bug on MacOS - wheel event doesn't fire for physical mouse wheel if no scroll event attached also
    this.addEventListener('scroll', () => {}, {
      passive: true,
    });
  }
}

EditorScroller.template = /* HTML */ ` <slot></slot> `;
