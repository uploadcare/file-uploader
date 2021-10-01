import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class SimpleBtn extends BlockComponent {
  initCallback() {
    this.onclick = () => {
      if (this.$['*uploadList'].length) {
        this.set$({
          '*currentActivity': 'upload-list',
          '*modalActive': true,
        });
      } else {
        this.set$({
          '*currentActivity': 'source-select',
          '*modalCaption': this.l10n('select-file-source'),
          '*modalActive': true,
        });
      }
    };
  }
}

SimpleBtn.template = /*html*/ `
<button>
  <uc-icon name="upload"></uc-icon>
  <span l10n="upload-files"></span>
</button>`;
