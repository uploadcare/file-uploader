import { CloudImageEditorBlock } from '../../blocks/CloudImageEditor/src/CloudImageEditorBlock';

/**
 * Public `<uc-cloud-image-editor>` element. Thin subclass of the v2
 * editor block — adds the `uc-wgt-common` host attribute so theme CSS
 * applies. Telemetry / a11y / `*solution` state were tied to v1's
 * `LitBlock`; in v2 they're optional services that flow through the
 * editor context when mounted inside `<uc-uploader>`, no-op otherwise.
 */
export class CloudImageEditor extends CloudImageEditorBlock {
  public static override styleAttrs: string[] = [...CloudImageEditorBlock.styleAttrs, 'uc-wgt-common'];
}

if (!customElements.get('uc-cloud-image-editor')) {
  customElements.define('uc-cloud-image-editor', CloudImageEditor);
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-cloud-image-editor': CloudImageEditor;
  }
}
