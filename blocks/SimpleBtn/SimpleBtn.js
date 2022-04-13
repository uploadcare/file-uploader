import { Block } from '../../abstract/Block.js';

export class SimpleBtn extends Block {
  init$ = {
    '*simpleButtonText': '',
    onClick: this.initFlow.bind(this),
  };

  initCallback() {
    super.initCallback();
    let multipleStateKey = this.bindCssData('--cfg-multiple');
    this.sub(multipleStateKey, (val) => {
      this.$['*simpleButtonText'] = val ? this.l10n('upload-files') : this.l10n('upload-file');
    });
  }
}

SimpleBtn.template = /*html*/ `
<uc-drop-area>
  <button set="onclick: onClick">
    <uc-icon name="upload"></uc-icon>
    <span>{{*simpleButtonText}}</span>
    <slot></slot>
  </button>
</uc-drop-area>
`;
