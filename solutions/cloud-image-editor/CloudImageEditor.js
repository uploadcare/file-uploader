// @ts-check
import { InternalEventType } from '../../blocks/UploadCtxProvider/EventEmitter.js';
import { CloudImageEditorBlock } from '../../blocks/CloudImageEditor/src/CloudImageEditorBlock.js';

export class CloudImageEditor extends CloudImageEditorBlock {
  static styleAttrs = [...super.styleAttrs, 'uc-wgt-common'];

  constructor() {
    super();

    this.emit(InternalEventType.INIT_SOLUTION, undefined);

    this.init$ = {
      ...this.init$,
      '*solution': this.tagName,
    };
  }

  initCallback() {
    super.initCallback();

    this.a11y?.registerBlock(this);
  }
}
