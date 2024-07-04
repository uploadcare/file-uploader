// @ts-check
import { CloudImageEditorBlock } from '../../blocks/CloudImageEditor/src/CloudImageEditorBlock.js';

export class CloudImageEditor extends CloudImageEditorBlock {
  static styleAttrs = [...super.styleAttrs, 'uc-wgt-common'];

  initCallback() {
    super.initCallback();

    this.a11y?.registerBlock(this);
  }
}
