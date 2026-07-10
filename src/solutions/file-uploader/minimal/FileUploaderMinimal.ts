import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { InternalEventType } from '../../../blocks/UploadCtxProvider/EventEmitter';
import { ACTIVITY_TYPES } from '../../../lit/activity-constants';
import { LitSolutionBlock } from '../../../lit/LitSolutionBlock';
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

type BaseInitState = InstanceType<typeof LitSolutionBlock>['init$'];
type FileUploaderMinimalInitState = BaseInitState;

export class FileUploaderMinimal extends LitSolutionBlock {
  public static override lazyPlugins = fileUploaderLazyPlugins;

  public declare attributesMeta: {
    'ctx-name': string;
  };
  public static override styleAttrs = [...super.styleAttrs, 'uc-file-uploader-minimal'];

  @state()
  private _singleUpload = false;

  @state()
  private _buttonTextKey = 'choose-file';

  public constructor() {
    super();

    this.init$ = {
      ...this.init$,
    } as FileUploaderMinimalInitState;
  }

  public override initCallback(): void {
    super.initCallback();

    this.telemetryManager.sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });

    // Minimal layers a modal source picker over a persistent inline view: the
    // upload list is the *background* (it replaces the inline trigger once files
    // exist, no modal); everything else (the start-from picker, every source
    // activity) is *foreground* and opens over it. The inline `<uc-start-from>`
    // and `<uc-upload-list>` light up via the background slot's `[active]`
    // attribute (no manual class toggling). A completed flow lands on the
    // upload list.
    this.router.navigationStrategy = (to) => (to === ACTIVITY_TYPES.UPLOAD_LIST ? 'background' : 'foreground');
    this.router.configure({ doneActivity: ACTIVITY_TYPES.UPLOAD_LIST });

    // Background slot follows file state: the upload list once files exist,
    // otherwise the start-from trigger.
    this.sub('*uploadList', (list: unknown) => {
      const hasFiles = Array.isArray(list) && list.length > 0;
      this.router.setActivity(hasFiles ? ACTIVITY_TYPES.UPLOAD_LIST : ACTIVITY_TYPES.START_FROM);
    });

    this.subActivity((val) => {
      if (val === ACTIVITY_TYPES.UPLOAD_LIST) {
        this.router.closeModal();
      }
      if (!val) {
        this.router.setActivity(ACTIVITY_TYPES.START_FROM);
      }
    });

    this.subConfigValue('confirmUpload', (confirmUpload) => {
      if (confirmUpload !== false) {
        this.cfg.confirmUpload = false;
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
            @click=${() => this.router.traverse('onCancel')}
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
