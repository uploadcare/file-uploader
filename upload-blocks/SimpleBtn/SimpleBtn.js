import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class SimpleBtn extends BlockComponent {
  init$ = {
    '*simpleButtonText': '',
  };

  initCallback() {
    let multipleStateKey = this.bindCssData('--cfg-multiple');
    this.sub(multipleStateKey, (val) => {
      this.$['*simpleButtonText'] = val ? this.l10n('upload-files') : this.l10n('upload-file');
    });
    this.onclick = () => {
      this.$['*modalActive'] = true;
      if (this.$['*uploadList']?.length) {
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
  <span>{{*simpleButtonText}}</span>
  <slot></slot>
</button>`;
