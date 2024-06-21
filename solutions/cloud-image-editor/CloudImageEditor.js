// @ts-check
import { CloudImageEditorBlock } from '../../blocks/CloudImageEditor/src/CloudImageEditorBlock.js';

export class CloudImageEditor extends CloudImageEditorBlock {
  static styleAttrs = [...super.styleAttrs, 'lr-wgt-common'];
}
