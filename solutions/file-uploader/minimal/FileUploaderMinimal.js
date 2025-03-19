//@ts-check
import { ActivityBlock } from '../../../abstract/ActivityBlock.js';
import { SolutionBlock } from '../../../abstract/SolutionBlock.js';
import { ModalEvents } from '../../../abstract/ModalManager.js';

const ACTIVE_CLASS = 'active';
const EMPTY_CLASS = '';

export class FileUploaderMinimal extends SolutionBlock {
  static styleAttrs = [...super.styleAttrs, 'uc-file-uploader-minimal'];

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      singleUpload: false,
      isHiddenStartFrom: false,
      classUploadList: EMPTY_CLASS,
      classStartFrom: EMPTY_CLASS,
    };
  }

  /** @type {import('../../../abstract/ModalManager.js').ModalCb} */
  _handleModalOpen(e) {
    if (e.id === ActivityBlock.activities.CLOUD_IMG_EDIT) {
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

    if (this.$['*uploadList']?.length <= 0) {
      this.set$({
        classStartFrom: ACTIVE_CLASS,
      });
    }
  }

  /** @type {import('../../../abstract/ModalManager.js').ModalCb} */
  _handleModalClose(e) {
    if (e.id === this.$['*currentActivity']) {
      this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
      this.set$({
        isHiddenStartFrom: false,
      });
    }

    if (e.id === ActivityBlock.activities.CLOUD_IMG_EDIT) {
      this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
    }
  }

  initCallback() {
    super.initCallback();

    /** @type {import('../../../abstract/UploaderBlock.js').UploaderBlock} */
    const uBlock = this.ref.uBlock;
    this.sub('*currentActivity', (val) => {
      if (val === ActivityBlock.activities.UPLOAD_LIST) {
        this.modalManager.closeAll();
      }

      if (!val) {
        this.$['*currentActivity'] = uBlock.initActivity || ActivityBlock.activities.START_FROM;
      }
    });

    this.sub('*uploadList', (list) => {
      if (list?.length > 0) {
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

    this.handleModalOpen = this._handleModalOpen.bind(this);
    this.handleModalClose = this._handleModalClose.bind(this);

    this.modalManager.subscribe(ModalEvents.OPEN, this.handleModalOpen);
    this.modalManager.subscribe(ModalEvents.CLOSE, this.handleModalClose);
  }

  destroyCallback() {
    super.destroyCallback();
    this.modalManager.unsubscribe(ModalEvents.OPEN, this.handleModalOpen);
    this.modalManager.unsubscribe(ModalEvents.CLOSE, this.handleModalClose);
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
