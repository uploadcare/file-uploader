import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class Icon extends BlockComponent {
  init$ = {
    name: '',
    path: '',
  };

  connectedCallback() {
    super.connectedCallback();
    this.sub('name', (val) => {
      if (!val) {
        return;
      }
      let path = this.getCssData(`--icon-${val}`);
      if (path) {
        this.$.path = path;
      }
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
  name: 'name',
});
