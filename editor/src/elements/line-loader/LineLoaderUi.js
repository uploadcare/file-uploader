import { AppComponent } from '../../AppComponent.js';

const STYLES = {
  ':host': {
    position: 'absolute',
    top: '0px',
    left: '0px',
    height: '2px',
    width: '100%',
    opacity: '0.5',
    zIndex: '9999',
  },
  inner: {
    height: '100%',
    maxWidth: '200px',
    width: '25%',
  },
  line: {
    backgroundColor: 'var(--color-primary-accent)',
    width: '100%',
    height: '100%',
    transition: 'transform 1s',
    transform: 'translateX(-100%)',
  },
};

export class LineLoaderUi extends AppComponent {
  constructor() {
    super();

    this._active = false;

    this._handleTransitionEndRight = () => {
      let lineEl = this['line-el'];
      lineEl.style.transition = `initial`;
      lineEl.style.opacity = '0';
      lineEl.style.transform = `translateX(-100%)`;
      this._active && this._start();
    };
  }

  readyCallback() {
    super.readyCallback();
    this.defineAccessor('active', (active) => {
      if (typeof active === 'boolean') {
        if (active) {
          this._start();
        } else {
          this._stop();
        }
      }
    });
  }

  _start() {
    this._active = true;
    let { width } = this.getBoundingClientRect();
    let lineEl = this['line-el'];
    lineEl.style.transition = `transform 1s`;
    lineEl.style.opacity = '1';
    lineEl.style.transform = `translateX(${width}px)`;
    lineEl.addEventListener('transitionend', this._handleTransitionEndRight, { once: true });
  }

  _stop() {
    this._active = false;
  }
}

LineLoaderUi.styles = STYLES;
LineLoaderUi.template = /*html*/ `
  <div css="inner">
    <div css="line" ref="line-el"></div>
  </div>
`;
