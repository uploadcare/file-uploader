import { fileUploaderDefaultPlugins } from '../default-plugins';
import { UploaderRegular } from './UploaderRegular';

/**
 * v1-compat shim — `<uc-file-uploader-regular>`.
 *
 * Subclass of v2's `UploaderRegular`. Same `headless` / `dynamic-button`
 * attributes, same `plugins` property, same render output. v1's
 * `lazyPlugins` static and `isDynamicBtnActive` getter are no longer
 * implemented; instead the default plugin set (local / url / camera /
 * external-sources / image-shrink) is auto-installed on connect for v1
 * parity. Consumers can still set `plugins` explicitly to override.
 *
 * @deprecated Use `<uc-uploader-regular>` directly. This element will
 * be removed in the next major version.
 */
export class FileUploaderRegular extends UploaderRegular {
  public override connectedCallback(): void {
    if (this.plugins.length === 0) {
      this.plugins = [...fileUploaderDefaultPlugins];
    }
    super.connectedCallback();
  }
}

if (!customElements.get('uc-file-uploader-regular')) {
  customElements.define('uc-file-uploader-regular', FileUploaderRegular);
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-file-uploader-regular': FileUploaderRegular;
  }
}
