import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class ProgressBarCommon extends BlockComponent {
  init$ = {
    visible: false,
    unknown: false,
    value: 0,

    '*commonProgress': 0,
  };

  initCallback() {
    this.sub('*commonProgress', (progress) => {
      if (progress === 0 || progress === 100) {
        this.$.visible = false;
        this.removeAttribute('active');
      } else {
        this.$.visible = true;
        this.setAttribute('active', '');
      }
      this.$.value = progress;
    });
  }
}

ProgressBarCommon.template = /*html*/ `
<uc-progress-bar set="visible: visible; unknown: unknown; value: value"></uc-progress-bar>
`;
