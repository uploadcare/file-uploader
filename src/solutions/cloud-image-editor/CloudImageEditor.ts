import { CloudImageEditorBlock } from '../../blocks/CloudImageEditor/src/CloudImageEditorBlock';
import { InternalEventType } from '../../blocks/UploadCtxProvider/EventEmitter';

export class CloudImageEditor extends CloudImageEditorBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-wgt-common'];

  public override initCallback(): void {
    super.initCallback();

    // Register the solution identity before the init event so the telemetry
    // payload's `component` carries it. (The old `init$`-seeded `*solution`
    // entry was first-write-wins and depended on this element initializing
    // before any other block in the ctx — an explicit call has no such race.)
    this.sharedCtx.uploaderController().setSolutionName(this.tagName);

    this.telemetryManager.sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });

    this.a11y?.registerBlock(this);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-cloud-image-editor': CloudImageEditor;
  }
}
