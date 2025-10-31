import { ActivityBlock } from '../../../abstract/ActivityBlock';
import type { ModalCb } from '../../../abstract/managers/ModalManager';
import { ModalEvents } from '../../../abstract/managers/ModalManager';
import { SolutionBlock } from '../../../abstract/SolutionBlock';
import type { UploaderBlock } from '../../../abstract/UploaderBlock';
import { InternalEventType } from '../../../blocks/UploadCtxProvider/EventEmitter';
import './index.css';

const ACTIVE_CLASS = 'active';
const EMPTY_CLASS = '';

type BaseInitState = InstanceType<typeof SolutionBlock>['init$'];
interface FileUploaderMinimalInitState extends BaseInitState {
  singleUpload: boolean;
  isHiddenStartFrom: boolean;
  classUploadList: string;
  classStartFrom: string;
}

export class FileUploaderMinimal extends SolutionBlock {
  static override styleAttrs = [...super.styleAttrs, 'uc-file-uploader-minimal'];

  private handleModalOpen?: ModalCb;
  private handleModalClose?: ModalCb;

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      singleUpload: false,
      isHiddenStartFrom: false,
      classUploadList: EMPTY_CLASS,
      classStartFrom: EMPTY_CLASS,
      '*solution': this.tagName,
    } as FileUploaderMinimalInitState;
  }

  private _handleModalOpen(data: Parameters<ModalCb>[0]): void {
    if (data.id === ActivityBlock.activities.CLOUD_IMG_EDIT) {
      this.set$({
        classUploadList: ACTIVE_CLASS,
      });
    }

    if (this.$['*currentActivity'] === ActivityBlock.activities.UPLOAD_LIST) {
      this.set$({
        classUploadList: ACTIVE_CLASS,
        isHiddenStartFrom: true,
      });
    }

    const uploadList = this.$['*uploadList'] as unknown[] | undefined;
    if (!uploadList || uploadList.length <= 0) {
      this.set$({
        classStartFrom: ACTIVE_CLASS,
      });
    }
  }

  private _handleModalClose(data: Parameters<ModalCb>[0]): void {
    if (data.id === this.$['*currentActivity']) {
      this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
      this.set$({
        isHiddenStartFrom: false,
      });
    }

    if (data.id === ActivityBlock.activities.CLOUD_IMG_EDIT) {
      this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
    }
  }

  override initCallback(): void {
    super.initCallback();

    this.telemetryManager.sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });

    const uBlock = this.ref.uBlock as UploaderBlock | undefined;
    if (!uBlock) {
      return;
    }

    this.sub('*currentActivity', (val: string | null) => {
      if (val === ActivityBlock.activities.UPLOAD_LIST) {
        this.modalManager?.closeAll();
      }

      if (!val) {
        this.$['*currentActivity'] = uBlock.initActivity || ActivityBlock.activities.START_FROM;
      }
    });

    this.sub('*uploadList', (list: unknown) => {
      if (Array.isArray(list) && list.length > 0) {
        this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
        this.set$({
          classStartFrom: EMPTY_CLASS,
        });
      } else {
        this.set$({
          classUploadList: EMPTY_CLASS,
          isHiddenStartFrom: false,
        });
        this.$['*currentActivity'] = uBlock.initActivity || ActivityBlock.activities.START_FROM;
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

          this.$.singleUpload = !multiple;
        } else {
          this.style.removeProperty('--uc-grid-col');
          this.$.singleUpload = false;
        }
      });
    });

    this.handleModalOpen = (event) => {
      this._handleModalOpen(event);
    };
    this.handleModalClose = (event) => {
      this._handleModalClose(event);
    };

    this.modalManager?.subscribe(ModalEvents.OPEN, this.handleModalOpen);
    this.modalManager?.subscribe(ModalEvents.CLOSE, this.handleModalClose);
  }

  override destroyCallback(): void {
    super.destroyCallback();
    this.modalManager?.unsubscribe(ModalEvents.OPEN, this.handleModalOpen);
    this.modalManager?.unsubscribe(ModalEvents.CLOSE, this.handleModalClose);
  }
}

FileUploaderMinimal.template = /* HTML */ `
  <uc-start-from set="@hidden: isHiddenStartFrom; @class:classStartFrom">
    <uc-drop-area set="@single:singleUpload;" initflow clickable tabindex="0" l10n="choose-file"></uc-drop-area>
    <uc-copyright></uc-copyright>
  </uc-start-from>
  <uc-upload-list set="@class:classUploadList" ref="uBlock"></uc-upload-list>

  <uc-modal id="start-from" strokes block-body-scrolling>
    <uc-start-from>
      <uc-drop-area with-icon clickable></uc-drop-area>
      <uc-source-list role="list" wrap></uc-source-list>
      <button type="button" l10n="start-from-cancel" class="uc-secondary-btn" set="onclick: *historyBack"></button>
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
