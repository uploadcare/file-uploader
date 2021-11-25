import { BaseComponent } from '../../ext_modules/symbiote.js';

export class Icon extends BaseComponent {
  init$ = {
    path: '',
  };

  initCallback() {
    this.defineAccessor('name', (val) => {
      if (!val) {
        return;
      }
      this.$.path = this.getCssData(`--icon-${val}`);
    });
  }
}

Icon.template = /*html*/ `
<svg
  viewBox="0 0 24 24"
  xmlns="http://www.w3.org/2000/svg">
  <path set="@d: path"></path>
</svg>
`;

Icon.bindAttributes({
  name: null,
});
