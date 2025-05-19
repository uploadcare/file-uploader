// @ts-check
import { InternalEventType } from '../../blocks/UploadCtxProvider/EventEmitter.js';
import { CloudImageEditorBlock } from '../../blocks/CloudImageEditor/src/CloudImageEditorBlock.js';

export class CloudImageEditor extends CloudImageEditorBlock {
  static styleAttrs = [...super.styleAttrs, 'uc-wgt-common'];

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      '*solution': this.tagName,
    };
  }

  initCallback() {
    super.initCallback();

    this.emit(InternalEventType.INIT_SOLUTION, undefined);

    this.a11y?.registerBlock(this);
  }
}
