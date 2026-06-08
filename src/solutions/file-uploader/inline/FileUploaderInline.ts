import { fileUploaderDefaultPlugins } from '../default-plugins';
import { UploaderInline } from './UploaderInline';

/**
 * v1-compat shim — `<uc-file-uploader-inline>`. Subclass of v2's
 * `UploaderInline`. Auto-installs the default plugin set for v1 parity
 * (see `default-plugins.ts`).
 *
 * @deprecated Use `<uc-uploader-inline>` directly. This element will be
 * removed in the next major version.
 */
export class FileUploaderInline extends UploaderInline {
  public override connectedCallback(): void {
    if (this.plugins.length === 0) {
      this.plugins = [...fileUploaderDefaultPlugins];
    }
    super.connectedCallback();
  }
}

if (!customElements.get('uc-file-uploader-inline')) {
  customElements.define('uc-file-uploader-inline', FileUploaderInline);
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-file-uploader-inline': FileUploaderInline;
  }
}
