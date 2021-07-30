import { AppComponent } from './AppComponent.js';

const X_THRESHOLD = 1;

const STYLES = {
  ':host': {
    width: '100%',
    height: '100%',
    overflowX: 'scroll',
    display: 'flex',
    alignItems: 'center',
  },
};

export class EditorScroller extends AppComponent {
  readyCallback() {
    super.readyCallback();

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

EditorScroller.renderShadow = false;
EditorScroller.styles = STYLES;

EditorScroller.template = /*html*/ `
<slot></slot>
`;
