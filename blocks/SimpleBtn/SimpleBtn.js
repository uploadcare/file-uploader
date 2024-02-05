// @ts-check
import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { asBoolean } from '../Config/normalizeConfigValue.js';

export class SimpleBtn extends UploaderBlock {
  couldBeCtxOwner = true;
  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      '*simpleButtonText': '',
      withDropZone: true,
      onClick: () => {
        this.initFlow();
      },
    };
  }

  initCallback() {
    super.initCallback();

    this.defineAccessor(
      'dropzone',
      /** @param {unknown} val */
      (val) => {
        if (typeof val === 'undefined') {
          return;
        }
        this.$.withDropZone = asBoolean(val);
      },
    );
    this.subConfigValue('multiple', (val) => {
      this.$['*simpleButtonText'] = val ? this.l10n('upload-files') : this.l10n('upload-file');
    });
  }
}

SimpleBtn.template = /* HTML */ `
  <lr-drop-area set="@disabled: !withDropZone">
    <button type="button" set="onclick: onClick">
      <lr-icon name="upload"></lr-icon>
      <span>{{*simpleButtonText}}</span>
      <slot></slot>
      <div class="visual-drop-area"></div>
    </button>
  </lr-drop-area>
`;

SimpleBtn.bindAttributes({
  // @ts-expect-error TODO: we need to update symbiote types
  dropzone: null,
});
