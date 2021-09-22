import { BaseComponent } from '../../symbiote/core/BaseComponent.js';

export class Icon extends BaseComponent {
  constructor() {
    super();
    this.initLocalState({
      path: '',
    });
    this.defineAccessor(
      'name',
      (val) => {
        if (!val) {
          return;
        }
        this.pub('local', 'path', this.getCssData(`--icon-${val}`));
      },
      true
    );
  }
}

Icon.template = /*html*/ `
<svg
  viewBox="0 0 24 24"
  xmlns="http://www.w3.org/2000/svg">
  <path loc="@d: path"></path>
</svg>
`;
Icon.bindAttributes({
  name: ['property'],
});
