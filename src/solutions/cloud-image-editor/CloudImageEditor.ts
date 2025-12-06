import { CloudImageEditorBlock } from '../../blocks/CloudImageEditor/src/CloudImageEditorBlock';
import { InternalEventType } from '../../blocks/UploadCtxProvider/EventEmitter';

type BaseInitState = InstanceType<typeof CloudImageEditorBlock>['init$'];
interface CloudImageEditorInitState extends BaseInitState {
  '*solution': string;
}

export class CloudImageEditor extends CloudImageEditorBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-wgt-common'];

  public constructor() {
    super();

    this.init$ = {
      ...this.init$,
      '*solution': this.tagName,
    } as CloudImageEditorInitState;
  }

  public override initCallback(): void {
    super.initCallback();

    this.telemetryManager.sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });

    this.a11y?.registerBlock(this);
  }
}
