import { html } from 'lit';
import { state } from 'lit/decorators.js';
import type { UploaderController } from '../../../abstract/controllers/UploaderController';
import { InternalEventType } from '../../../blocks/UploadCtxProvider/EventEmitter';
import { ACTIVITY_TYPES } from '../../../lit/activity-constants';
import { SolutionChildBlock } from '../../../lit/SolutionChildBlock';
import './index.css';
import { fileUploaderLazyPlugins } from '../lazyPlugins.js';

import '../../../blocks/Modal/Modal';
import '../../../blocks/StartFrom/StartFrom';
import '../../../blocks/DropArea/DropArea';
import '../../../blocks/Copyright/Copyright';
import '../../../blocks/UploadList/UploadList';
import '../../../blocks/SourceList/SourceList';
import '../../../blocks/CloudImageEditorActivity/CloudImageEditorActivity';
import '../../../blocks/PluginActivityRenderer/PluginActivityRenderer';

export class FileUploaderMinimal extends SolutionChildBlock {
  public static override lazyPlugins = fileUploaderLazyPlugins;

  // Type-only: feeds the JSX attribute typing (`ReflectAttributes` in
  // `types/jsx.d.ts` reads `attributesMeta`). Kept on the ChildBlock port —
  // the documented attribute surface, same as the merged `Config` port.
  public declare attributesMeta: {
    'ctx-name': string;
  };
  public static override styleAttrs = [...super.styleAttrs, 'uc-file-uploader-minimal'];

  @state()
  private _singleUpload = false;

  @state()
  private _buttonTextKey = 'choose-file';

  protected override controllerReady(ctrl: UploaderController): void {
    super.controllerReady(ctrl);

    this.bag.telemetryManager.sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });

    // Minimal layers a modal source picker over a persistent inline view: the
    // upload list is the *background* (it replaces the inline trigger once files
    // exist, no modal); everything else (the start-from picker, every source
    // activity) is *foreground* and opens over it. The inline `<uc-start-from>`
    // and `<uc-upload-list>` light up via the background slot's `[active]`
    // attribute (no manual class toggling). A completed flow lands on the
    // upload list.
    this.bag.router.navigationStrategy = (to) => (to === ACTIVITY_TYPES.UPLOAD_LIST ? 'background' : 'foreground');
    this.bag.router.configure({ doneActivity: ACTIVITY_TYPES.UPLOAD_LIST });

    // Background slot follows file state: the upload list once files exist,
    // otherwise the start-from trigger.
    this.trackSub(
      this.bag.ctx.sub('*uploadList', (list) => {
        const hasFiles = list.length > 0;
        this.bag.router.setActivity(hasFiles ? ACTIVITY_TYPES.UPLOAD_LIST : ACTIVITY_TYPES.START_FROM);
      }),
    );

    this.subActivity((val) => {
      if (val === ACTIVITY_TYPES.UPLOAD_LIST) {
        this.bag.router.closeModal();
      }
      if (!val) {
        this.bag.router.setActivity(ACTIVITY_TYPES.START_FROM);
      }
    });

    this.subConfigValue('confirmUpload', (confirmUpload) => {
      if (confirmUpload !== false) {
        this.uploader.config.set('confirmUpload', false);
      }
    });

    this.subConfigValue('filesViewMode', (mode) => {
      this.setAttribute('mode', mode);

      this.subConfigValue('multiple', (multiple) => {
        if (mode === 'grid') {
          if (multiple) {
            this.style.removeProperty('--uc-grid-col');
          } else {
            this.style.setProperty('--uc-grid-col', '1');
          }

          this._singleUpload = !multiple;
        } else {
          this.style.removeProperty('--uc-grid-col');
          this._singleUpload = false;
        }
      });
    });

    this.subConfigValue('multiple', (val) => {
      this._buttonTextKey = val ? 'choose-files' : 'choose-file';
    });
  }

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [(listener: () => void) => ctrl.locale.subscribe(listener)];
  }

  public override render() {
    return html`
      ${super.render()}
      <uc-start-from>
        <uc-drop-area
          ?single=${this._singleUpload}
          initflow
          clickable
          tabindex="0"
        ><span>${this.l10n(this._buttonTextKey)}</span></uc-drop-area>
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
            @click=${() => this.bag.router.traverse('onCancel')}
          >${this.l10n('start-from-cancel')}</button>
        </uc-start-from>
      </uc-modal>

        <uc-plugin-activity-renderer mode="modal"></uc-plugin-activity-renderer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-file-uploader-minimal': FileUploaderMinimal;
  }
}
