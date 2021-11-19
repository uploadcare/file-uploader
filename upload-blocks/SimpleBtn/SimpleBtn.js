import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class SimpleBtn extends BlockComponent {
  init$ = () => ({
    '*simpleButtonText': this.config.MULTIPLE ? this.l10n('upload-files') : this.l10n('upload-file'),
  });

  initCallback() {
    this.onclick = () => {
      if (this.$['*uploadList'].length) {
        this.set$({
          '*currentActivity': BlockComponent.activities.UPLOAD_LIST,
          '*modalActive': true,
        });
      } else {
        this.set$({
          '*currentActivity': BlockComponent.activities.SOURCE_SELECT,
          '*modalActive': true,
        });
      }
    };
  }
}

SimpleBtn.template = /*html*/ `
<button>
  <uc-icon name="upload"></uc-icon>
  <span set="textContent: *simpleButtonText"></span>
  <slot></slot>
</button>`;
