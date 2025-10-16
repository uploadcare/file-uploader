import { CloudImageEditorBlock } from '../../blocks/CloudImageEditor/src/CloudImageEditorBlock';
import { InternalEventType } from '../../blocks/UploadCtxProvider/EventEmitter';

type BaseInitState = InstanceType<typeof CloudImageEditorBlock>['init$'];
interface CloudImageEditorInitState extends BaseInitState {
  '*solution': string;
}

export class CloudImageEditor extends CloudImageEditorBlock {
  static override styleAttrs = [...super.styleAttrs, 'uc-wgt-common'];

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      '*solution': this.tagName,
    } as CloudImageEditorInitState;
  }

  override initCallback(): void {
    super.initCallback();

    this.emit(InternalEventType.INIT_SOLUTION, undefined);

    this.a11y?.registerBlock(this);
  }
}
