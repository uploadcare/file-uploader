// @ts-check
import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { asBoolean } from '../Config/normalizeConfigValue.js';

export class SimpleBtn extends UploaderBlock {
  static styleAttrs = [...super.styleAttrs, 'lr-simple-btn'];
  couldBeCtxOwner = true;
  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      withDropZone: true,
      onClick: () => {
        this.api.initFlow();
      },
      'button-text': '',
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
      this.$['button-text'] = val ? 'upload-files' : 'upload-file';
    });
  }
}

SimpleBtn.template = /* HTML */ `
  <lr-drop-area set="@disabled: !withDropZone">
    <button type="button" set="onclick: onClick">
      <lr-icon name="upload"></lr-icon>
      <span l10n="button-text"></span>
      <slot></slot>
      <div class="visual-drop-area" l10n="drop-files-here"></div>
    </button>
  </lr-drop-area>
`;

SimpleBtn.bindAttributes({
  // @ts-expect-error TODO: we need to update symbiote types
  dropzone: null,
});
