import { A11y } from '../../abstract/managers/a11y';
import { CloudImageEditorBlock } from '../../blocks/CloudImageEditor/src/CloudImageEditorBlock';
import { InternalEventType } from '../../blocks/UploadCtxProvider/EventEmitter';

export class CloudImageEditor extends CloudImageEditorBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-wgt-common'];

  /** Self-owned keyux keyboard nav — armed for the standalone / sibling-`<uc-config>` compositions (see `initCallback`). */
  private _a11y: A11y | undefined;

  protected override initCallback(): void {
    super.initCallback();

    // Own keyux keyboard navigation for the editor's scope, independent of the
    // uploader — so a standalone `<uc-cloud-image-editor>` (no `<uc-config>`)
    // still gets it. Skipped in the uploader-plugin path (rendered inside
    // `<uc-cloud-image-editor-activity>`), where the uploader's a11y scope
    // already `contains` this subtree — a second scope would double-handle keys.
    if (!this.closest('uc-cloud-image-editor-activity')) {
      this._a11y = new A11y();
      this._a11y.registerBlock(this);
    }

    // Attribute the init event to the editor solution tag directly. The editor
    // registers no uploader `solutionName` (that coupling is what the isolation
    // removes), so the event carries its own `component`. Buffered by
    // `_emitTelemetry` until the compat bridge (if any) supplies a manager.
    this.telemetry.sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
      component: this.tagName.toLowerCase(),
    });
  }

  public override disconnectedCallback(): void {
    this._a11y?.destroy();
    this._a11y = undefined;
    super.disconnectedCallback();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-cloud-image-editor': CloudImageEditor;
  }
}
