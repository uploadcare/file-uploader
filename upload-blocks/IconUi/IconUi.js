import { BaseComponent } from '../../symbiote/core/BaseComponent.js';

export class IconUi extends BaseComponent {
  constructor() {
    super();
    this.initLocalState({
      path: '',
    });
    this.defineAccessor('name', (val) => {
      if (!val) {
        return;
      }
      this.localState.pub('path', this.getCssData(`--icon-${val}`));
    }, true);
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
  name: ['property'],
});