import { html } from 'lit';
import './index.css';
import '../../../blocks/Copyright/Copyright';
import '../../../blocks/DropArea/DropArea';
import '../../../blocks/PluginActivityRenderer/PluginActivityRenderer';
import '../../../blocks/SourceList/SourceList';
import '../../../blocks/StartFrom/StartFrom';
import '../../../blocks/UploadList/UploadList';
import { Uploader } from '../../../abstract/Uploader';

/**
 * Inline preset. Renders start-from + upload-list directly in the host
 * (no modal) plus the inline-mode plugin activities. v1's
 * `inline/index.css` scopes its rules to `[uc-file-uploader-inline]`, so
 * the host carries that attribute for the styles to apply.
 */
export class UploaderInline extends Uploader {
  public static override styleAttrs = [...super.styleAttrs, 'uc-file-uploader-inline'];

  protected override initialActivity() {
    return 'start-from' as const;
  }

  /**
   * Inline preset has no modals — every navigation updates the
   * background activity so the host's inline content (picker, upload
   * list, plugin activities via `mode="inline"`) swaps in place.
   */
  protected override navigationSlotFor(): 'background' {
    return 'background';
  }

  private _cancel = (): void => this.api.close();

  protected override renderLayout() {
    const t = (key: string): string => this.controller.locale.t(key);
    return html`
      <uc-start-from>
        <uc-drop-area with-icon clickable></uc-drop-area>
        <uc-source-list role="list" wrap></uc-source-list>
        <button
          type="button"
          class="uc-cancel-btn uc-secondary-btn"
          @click=${this._cancel}
        >${t('start-from-cancel')}</button>
        <uc-copyright></uc-copyright>
      </uc-start-from>
      <uc-upload-list></uc-upload-list>
      <uc-plugin-activity-renderer mode="inline"></uc-plugin-activity-renderer>
    `;
  }
}

if (!customElements.get('uc-uploader-inline')) customElements.define('uc-uploader-inline', UploaderInline);

declare global {
  interface HTMLElementTagNameMap {
    'uc-uploader-inline': UploaderInline;
  }
}
