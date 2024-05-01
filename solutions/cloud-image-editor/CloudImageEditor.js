// @ts-check
import { CloudImageEditorBlock } from '../../blocks/CloudImageEditor/src/CloudImageEditorBlock.js';

export class CloudImageEditor extends CloudImageEditorBlock {
  initCallback() {
    super.initCallback();

    /** @private */
    this.__shadowReady = true;

    this.$['*faderEl'] = this.ref['fader-el'];
    this.$['*cropperEl'] = this.ref['cropper-el'];
    this.$['*imgContainerEl'] = this.ref['img-container-el'];

    this.initEditor();
  }

  async initEditor() {
    if (this.__shadowReady) {
      await super.initEditor();
    }
  }
}
