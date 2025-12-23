import { html } from 'lit';
import { state } from 'lit/decorators.js';
import type { ModalCb } from '../../../abstract/managers/ModalManager';
import { ModalEvents } from '../../../abstract/managers/ModalManager';
import { InternalEventType } from '../../../blocks/UploadCtxProvider/EventEmitter';
import { LitActivityBlock } from '../../../lit/LitActivityBlock';
import { LitSolutionBlock } from '../../../lit/LitSolutionBlock';
import './index.css';

const ACTIVE_CLASS = 'active';
const EMPTY_CLASS = '';

type BaseInitState = InstanceType<typeof LitSolutionBlock>['init$'];
type FileUploaderMinimalInitState = BaseInitState & {
  '*solution': string;
};

export class FileUploaderMinimal extends LitSolutionBlock {
  public declare propertiesMeta: {
    'ctx-name': string;
  };
  public static override styleAttrs = [...super.styleAttrs, 'uc-file-uploader-minimal'];

  @state()
  private _singleUpload = false;

  @state()
  private _isHiddenStartFrom = false;

  @state()
  private _classUploadList = EMPTY_CLASS;

  @state()
  private _classStartFrom = EMPTY_CLASS;

  private _getInitActivity(): string {
    return (this.getCssData('--cfg-init-activity') as string | undefined) || LitActivityBlock.activities.START_FROM;
  }

  public constructor() {
    super();

    this.init$ = {
      ...this.init$,
      '*solution': this.tagName,
    } as FileUploaderMinimalInitState;
  }

  private _handleModalOpen = (data: Parameters<ModalCb>[0]): void => {
    if (data.id === LitActivityBlock.activities.CLOUD_IMG_EDIT) {
      this._classUploadList = ACTIVE_CLASS;
    }

    if (this.$['*currentActivity'] === LitActivityBlock.activities.UPLOAD_LIST) {
      this._classUploadList = ACTIVE_CLASS;
      this._isHiddenStartFrom = true;
    }

    const uploadList = this.$['*uploadList'] as unknown[] | undefined;
    if (!uploadList || uploadList.length <= 0) {
      this._classStartFrom = ACTIVE_CLASS;
    }
  };

  private _handleModalClose = (data: Parameters<ModalCb>[0]): void => {
    if (data.id === this.$['*currentActivity']) {
      this.$['*currentActivity'] = LitActivityBlock.activities.UPLOAD_LIST;
      this._isHiddenStartFrom = false;
    }

    if (data.id === LitActivityBlock.activities.CLOUD_IMG_EDIT) {
      this.$['*currentActivity'] = LitActivityBlock.activities.UPLOAD_LIST;
    }
  };

  public override initCallback(): void {
    super.initCallback();

    this.telemetryManager.sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });

    const initActivity = this._getInitActivity();

    this.sub('*currentActivity', (val: string | null) => {
      if (val === LitActivityBlock.activities.UPLOAD_LIST) {
        this.modalManager?.closeAll();
      }

      if (!val) {
        this.$['*currentActivity'] = initActivity;
      }
    });

    this.sub('*uploadList', (list: unknown) => {
      if (Array.isArray(list) && list.length > 0) {
        this.$['*currentActivity'] = LitActivityBlock.activities.UPLOAD_LIST;
        this._classStartFrom = EMPTY_CLASS;
      } else {
        this._classUploadList = EMPTY_CLASS;
        this._isHiddenStartFrom = false;
        this.$['*currentActivity'] = initActivity;
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

    this.modalManager?.subscribe(ModalEvents.OPEN, this._handleModalOpen);
    this.modalManager?.subscribe(ModalEvents.CLOSE, this._handleModalClose);
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.modalManager?.unsubscribe(ModalEvents.OPEN, this._handleModalOpen);
    this.modalManager?.unsubscribe(ModalEvents.CLOSE, this._handleModalClose);
  }

  public override render() {
    return html`
      ${super.render()}
      <uc-start-from ?hidden=${this._isHiddenStartFrom} class=${this._classStartFrom}>
        <uc-drop-area
          ?single=${this._singleUpload}
          initflow
          clickable
          tabindex="0"
        ><span>${this.l10n('choose-file')}</span></uc-drop-area>
        <uc-copyright></uc-copyright>
      </uc-start-from>
      <uc-upload-list class=${this._classUploadList}></uc-upload-list>

      <uc-modal id="start-from" strokes block-body-scrolling>
        <uc-start-from>
          <uc-drop-area with-icon clickable></uc-drop-area>
          <uc-source-list role="list" wrap></uc-source-list>
          <button
            type="button"
            class="uc-secondary-btn"
            @click=${this.$['*historyBack']}
          >${this.l10n('start-from-cancel')}</button>
        </uc-start-from>
      </uc-modal>

      <uc-modal id="camera" strokes block-body-scrolling>
        <uc-camera-source></uc-camera-source>
      </uc-modal>

      <uc-modal id="url" strokes block-body-scrolling>
        <uc-url-source></uc-url-source>
      </uc-modal>

      <uc-modal id="external" strokes block-body-scrolling>
        <uc-external-source></uc-external-source>
      </uc-modal>

      <uc-modal id="cloud-image-edit" strokes block-body-scrolling>
        <uc-cloud-image-editor-activity></uc-cloud-image-editor-activity>
      </uc-modal>
    `;
  }
}
