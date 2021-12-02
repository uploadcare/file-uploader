import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class SimpleBtn extends BlockComponent {
  init$ = {
    '*simpleButtonText': '',
  };

  initCallback() {
    this.$['*simpleButtonText'] = this.cfg('multiple') ? this.l10n('upload-files') : this.l10n('upload-file');
    this.onclick = () => {
      if (this.$['*uploadList'].length) {
        this.set$({
          '*currentActivity': BlockComponent.activities.UPLOAD_LIST,
        });
      } else {
        this.set$({
          '*currentActivity': BlockComponent.activities.SOURCE_SELECT,
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
