import { startKeyUX, hiddenKeyUX, jumpKeyUX, focusGroupKeyUX, pressKeyUX } from 'keyux';

export class A11y {
  constructor() {
    this.init();
  }

  init() {
    startKeyUX(window, [focusGroupKeyUX(), pressKeyUX('is-pressed'), jumpKeyUX(), hiddenKeyUX()]);
  }
}
