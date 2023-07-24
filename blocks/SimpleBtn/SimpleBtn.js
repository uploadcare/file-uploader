// @ts-check
import { UploaderBlock } from '../../abstract/UploaderBlock.js';

export class SimpleBtn extends UploaderBlock {
  // @ts-ignore TODO: fix this
  init$ = {
    ...this.init$,
    '*simpleButtonText': '',
    onClick: () => {
      this.initFlow();
    },
  };

  initCallback() {
    super.initCallback();
    this.subConfigValue('multiple', (val) => {
      this.$['*simpleButtonText'] = val ? this.l10n('upload-files') : this.l10n('upload-file');
    });
  }
}

SimpleBtn.template = /* HTML */ `
  <lr-drop-area>
    <button type="button" set="onclick: onClick">
      <lr-icon name="upload"></lr-icon>
      <span>{{*simpleButtonText}}</span>
      <slot></slot>
      <div class="visual-drop-area"></div>
    </button>
  </lr-drop-area>
`;
