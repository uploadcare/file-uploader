import { BaseComponent } from '../../symbiote/core/BaseComponent.js';

export class IconUi extends BaseComponent {

  constructor() {
    super();
    this.initLocalState({
      path: 'M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z',
    });
  }

  readyCallback() {
    this.localState.pub('path', this._path);
  }

  set path(val) {
    if (!val) {
      return;
    }
    this._path = val;
    this.localState?.pub('path', val);
  }
}

IconUi.template = /*html*/ `
<svg
  viewBox="0 0 24 24"
  xmlns="http://www.w3.org/2000/svg">
  <path loc="@d: path"></path>
</svg>
`;
IconUi.bindAttributes({
  path: ['property'],
});