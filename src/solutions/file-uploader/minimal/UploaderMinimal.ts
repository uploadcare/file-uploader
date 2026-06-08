import { html } from 'lit';
import './index.css';
import '../../../blocks/Copyright/Copyright';
import '../../../blocks/DropArea/DropArea';
import '../../../blocks/Modal/Modal';
import '../../../blocks/PluginActivityRenderer/PluginActivityRenderer';
import '../../../blocks/SourceList/SourceList';
import '../../../blocks/StartFrom/StartFrom';
import '../../../blocks/UploadList/UploadList';
import { Uploader } from '../../../abstract/Uploader';

/**
 * Minimal preset. Drag-and-drop area is the trigger; modals open as
 * needed for source selection and the upload list. v1's
 * `minimal/index.css` scopes its rules to `[uc-file-uploader-minimal]`,
 * so the host carries that attribute for the styles to apply.
 */
export class UploaderMinimal extends Uploader {
  public static override styleAttrs = [...super.styleAttrs, 'uc-file-uploader-minimal'];

  protected override initialActivity() {
    return 'start-from' as const;
  }

  /**
   * Minimal layers a persistent inline view (trigger or upload list)
   * behind a modal source picker:
   *
   * - `upload-list` is **background** — it replaces the trigger inline
   *   once files exist. No modal wraps it.
   * - Everything else (`start-from` picker, every source plugin's
   *   activity) is **foreground** — opens over the persistent trigger.
   *
   * `navigate('upload-list')` after a file upload thus closes whatever
   * modal was open (camera, picker, etc.) and surfaces the inline list.
   */
  protected override navigationSlotFor(
    to: import('../../../abstract/activity-ids').ActivityId,
  ): 'background' | 'foreground' {
    return to === 'upload-list' ? 'background' : 'foreground';
  }

  private _cancel = (): void => this.api.close();

  protected override renderLayout() {
    const t = (key: string): string => this.controller.locale.t(key);
    return html`
      <uc-start-from>
        <uc-drop-area initflow clickable tabindex="0">
          <span>${t('choose-files')}</span>
        </uc-drop-area>
        <uc-copyright></uc-copyright>
      </uc-start-from>
      <uc-upload-list></uc-upload-list>

      <uc-modal id="start-from" strokes block-body-scrolling>
        <uc-start-from>
          <uc-drop-area with-icon clickable></uc-drop-area>
          <uc-source-list role="list" wrap></uc-source-list>
          <button
            type="button"
            class="uc-secondary-btn"
            @click=${this._cancel}
          >${t('start-from-cancel')}</button>
        </uc-start-from>
      </uc-modal>

      <uc-plugin-activity-renderer mode="modal"></uc-plugin-activity-renderer>
    `;
  }
}

if (!customElements.get('uc-uploader-minimal')) customElements.define('uc-uploader-minimal', UploaderMinimal);

declare global {
  interface HTMLElementTagNameMap {
    'uc-uploader-minimal': UploaderMinimal;
  }
}
