import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class ProgressBar extends BlockComponent {
  init$ = {
    cssWidth: 0,
    '*commonProgress': 0,
  };

  initCallback() {
    this.sub('*commonProgress', (progress) => {
      if (progress === 0 || progress === 100) {
        this.removeAttribute('active');
      } else {
        this.setAttribute('active', '');
      }
      this.$.cssWidth = progress + '%';
    });
  }
}

ProgressBar.template = /*html*/ `
<div
  class="bar"
  set="style.width: cssWidth">
</div>
`;
