import { fileUploaderDefaultPlugins } from '../default-plugins';
import { UploaderMinimal } from './UploaderMinimal';

/**
 * v1-compat shim — `<uc-file-uploader-minimal>`. Subclass of v2's
 * `UploaderMinimal`. Auto-installs the default plugin set for v1 parity
 * (see `default-plugins.ts`).
 *
 * @deprecated Use `<uc-uploader-minimal>` directly. This element will be
 * removed in the next major version.
 */
export class FileUploaderMinimal extends UploaderMinimal {
  public override connectedCallback(): void {
    if (this.plugins.length === 0) {
      this.plugins = [...fileUploaderDefaultPlugins];
    }
    super.connectedCallback();
  }
}

if (!customElements.get('uc-file-uploader-minimal')) {
  customElements.define('uc-file-uploader-minimal', FileUploaderMinimal);
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-file-uploader-minimal': FileUploaderMinimal;
  }
}
