import { ElementComponent } from '@uploadcare/elements';

const X_THRESHOLD = 1;

export class EditorScroller extends ElementComponent {
  initCallback() {
    super.initCallback();

    this.addEventListener('wheel', (e) => {
      e.preventDefault();
      let { deltaY, deltaX } = e;
      if (Math.abs(deltaX) > X_THRESHOLD) {
        this.scrollLeft += deltaX;
      } else {
        this.scrollLeft += deltaY;
      }
    });
  }
}

EditorScroller.template = /*html*/ `
<slot></slot>
`;
