import { CloudImageEditorBlock } from '../../blocks/CloudImageEditor/src/CloudImageEditorBlock';
import { InternalEventType } from '../../blocks/UploadCtxProvider/EventEmitter';

export class CloudImageEditor extends CloudImageEditorBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-wgt-common'];

  protected override initCallback(): void {
    super.initCallback();

    this.telemetry.sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-cloud-image-editor': CloudImageEditor;
  }
}
