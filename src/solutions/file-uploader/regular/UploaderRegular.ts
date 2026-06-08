import { html } from 'lit';
import { property } from 'lit/decorators.js';
import './index.css';
import '../../../blocks/Copyright/Copyright';
import '../../../blocks/DropArea/DropArea';
import '../../../blocks/Modal/Modal';
import '../../../blocks/PluginActivityRenderer/PluginActivityRenderer';
import '../../../blocks/SimpleBtn/SimpleBtn';
import '../../../blocks/SmartBtn/SmartBtn';
import '../../../blocks/SourceList/SourceList';
import '../../../blocks/StartFrom/StartFrom';
import '../../../blocks/UploadList/UploadList';
import { Uploader } from '../../../abstract/Uploader';

/**
 * Regular preset. Renders the v2 layout directly — `<uc-simple-btn>` (or
 * `<uc-smart-btn>` when `smart-button` is set) trigger, modals for
 * start-from + upload-list, plugin activities, and the surrounding
 * `<uc-drop-area>` for drag-and-drop. v1's `regular/index.css` scopes
 * rules to `[uc-file-uploader-regular]`, so the host carries that
 * attribute for the styles to apply.
 */
export class UploaderRegular extends Uploader {
  public static override styleAttrs = [...super.styleAttrs, 'uc-file-uploader-regular'];

  /**
   * Swap the simple trigger for `<uc-smart-btn>` — the multi-state
   * dynamic toolbar (source picker + upload status + abort). Matches
   * v1's `<uc-file-uploader-regular smart-button>` attribute.
   */
  @property({ attribute: 'smart-button', type: Boolean })
  public smartButton = false;

  /**
   * Headless mode — suppresses the built-in trigger button. The consumer
   * builds custom UI and interacts via `element.api.*` events and methods.
   * Modals and activities still mount; only the persistent trigger is
   * omitted. Matches v1's `<uc-file-uploader-regular headless>` attribute.
   */
  @property({ type: Boolean })
  public headless = false;

  /**
   * Every regular-preset screen lives in a modal — the start-from
   * source picker, every external source, and the upload list. The
   * host's only persistent UI is the `<uc-simple-btn>` / `<uc-smart-btn>`
   * trigger, which isn't activity-bound.
   */
  protected override navigationSlotFor(): 'foreground' {
    return 'foreground';
  }

  private _cancel = (): void => this.api.close();

  private _renderTrigger() {
    if (this.headless) return null;
    return this.smartButton ? html`<uc-smart-btn></uc-smart-btn>` : html`<uc-simple-btn></uc-simple-btn>`;
  }

  protected override renderLayout() {
    const t = (key: string): string => this.controller.locale.t(key);
    return html`
      ${this._renderTrigger()}

      <uc-modal id="start-from" strokes block-body-scrolling>
        <uc-start-from>
          <uc-drop-area with-icon clickable></uc-drop-area>
          <uc-source-list role="list" wrap></uc-source-list>
          <button
            type="button"
            class="uc-secondary-btn"
            @click=${this._cancel}
          >${t('start-from-cancel')}</button>
          <uc-copyright></uc-copyright>
        </uc-start-from>
      </uc-modal>

      <uc-modal id="upload-list" strokes block-body-scrolling>
        <uc-upload-list></uc-upload-list>
      </uc-modal>

      <uc-plugin-activity-renderer mode="modal"></uc-plugin-activity-renderer>
    `;
  }
}

if (!customElements.get('uc-uploader-regular')) customElements.define('uc-uploader-regular', UploaderRegular);

declare global {
  interface HTMLElementTagNameMap {
    'uc-uploader-regular': UploaderRegular;
  }
}
