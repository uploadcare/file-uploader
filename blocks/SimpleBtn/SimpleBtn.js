import { Block } from '../../abstract/Block.js';

export class SimpleBtn extends Block {
  init$ = {
    '*simpleButtonText': '',
  };

  initCallback() {
    super.initCallback();
    let multipleStateKey = this.bindCssData('--cfg-multiple');
    this.sub(multipleStateKey, (val) => {
      this.$['*simpleButtonText'] = val ? this.l10n('upload-files') : this.l10n('upload-file');
    });
    this.onclick = () => {
      this.$['*modalActive'] = true;
      if (this.$['*uploadList']?.length) {
        this.set$({
          '*currentActivity': Block.activities.UPLOAD_LIST,
        });
      } else {
        this.set$({
          '*currentActivity': Block.activities.START_FROM,
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
