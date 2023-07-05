import { CloudImageEditorBlock } from '../../blocks/CloudImageEditor/src/CloudImageEditorBlock.js';
import { shadowed } from '../../blocks/ShadowWrapper/ShadowWrapper.js';

export * from '../../blocks/CloudImageEditor/index.js';

export class CloudImageEditor extends shadowed(CloudImageEditorBlock) {
  shadowReadyCallback() {
    /** @private */
    this.__shadowReady = true;

    this.$['*faderEl'] = this.ref['fader-el'];
    this.$['*cropperEl'] = this.ref['cropper-el'];
    this.$['*imgContainerEl'] = this.ref['img-container-el'];

    this.initEditor();
  }

  initEditor() {
    if (this.__shadowReady) {
      super.initEditor();
    }
  }
}
