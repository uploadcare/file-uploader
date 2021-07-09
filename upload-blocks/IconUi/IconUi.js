import { AppComponent } from '../AppComponent/AppComponent.js';

export class IconUi extends AppComponent {}

IconUi.template = /*html*/ `
<svg
  viewBox="0 0 24 24"
  xmlns="http://www.w3.org/2000/svg">
  <path sub="@d: path"></path>
</svg>
`;
IconUi.bindAttributes({
  path: {
    sub: true,
  },
});