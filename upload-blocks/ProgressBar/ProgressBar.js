import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class ProgressBar extends BlockComponent {

  initCallback() {
    this.externalState.sub('commonProgress', (progress) => {
      if (progress === 0 || progress === 100) {
        this.removeAttribute('active');
      } else {
        this.setAttribute('active', '');
      }
      this.ref.bar.style.width = progress + '%';
    });
  }
}

ProgressBar.template = /*html*/ `
<div ref="bar" -bar-></div>
`;