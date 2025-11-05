// @ts-check
import { html } from '@symbiotejs/symbiote';
import { ActivityBlock } from '../../abstract/ActivityBlock';
import { UploaderBlock } from '../../abstract/UploaderBlock';
import type { OutputCollectionErrorType, OutputError } from '../../types';
import { throttle } from '../../utils/throttle';
import { EventType } from '../UploadCtxProvider/EventEmitter';
import './upload-list.css';

export type FilesViewMode = 'grid' | 'list';

export type Summary = {
  total: number;
  succeed: number;
  uploading: number;
  failed: number;
  validatingBeforeUploading: number;
};

export class UploadList extends UploaderBlock {
  // Context owner should have access to CSS l10n
  // TODO: We need to move away l10n from CSS
  override couldBeCtxOwner = true;
  override historyTracked = true;
  override activityType = ActivityBlock.activities.UPLOAD_LIST;

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      doneBtnVisible: false,
      doneBtnEnabled: false,
      uploadBtnVisible: false,
      addMoreBtnVisible: false,
      addMoreBtnEnabled: false,
      headerText: '',
      commonErrorMessage: '',

      hasFiles: false,
      onAdd: () => {
        this.api.initFlow(true);
      },
      onUpload: () => {
        this.emit(EventType.UPLOAD_CLICK);
        this.api.uploadAll();
        this._throttledHandleCollectionUpdate();
      },
      onDone: () => {
        this.emit(EventType.DONE_CLICK, this.api.getOutputCollectionState());
        this.api.doneFlow();
      },
      onCancel: () => {
        this.uploadCollection.clearAll();
      },
    } as any;
  }

  private _throttledHandleCollectionUpdate = throttle(() => {
    if (!this.isConnected) {
      return;
    }
    this._updateUploadsState();

    if (!this.couldOpenActivity && this.$['*currentActivity'] === this.activityType) {
      this.historyBack();
    }

    if (!this.cfg.confirmUpload) {
      this.api.uploadAll();
    }
  }, 300);

  private _updateUploadsState(): void {
    const collectionState = this.api.getOutputCollectionState();
    const summary: Summary = {
      total: collectionState.totalCount,
      succeed: collectionState.successCount,
      uploading: collectionState.uploadingCount,
      failed: collectionState.failedCount,
      validatingBeforeUploading: collectionState.idleEntries.filter((e) => e.isValidationPending).length,
    };
    const fitCountRestrictions = !collectionState.errors.some(
      (err) => err.type === 'TOO_MANY_FILES' || err.type === 'TOO_FEW_FILES',
    );
    const tooMany = collectionState.errors.some((err) => err.type === 'TOO_MANY_FILES');
    const exact = collectionState.totalCount === (this.cfg.multiple ? this.cfg.multipleMax : 1);
    const isValidationPending = collectionState.allEntries.some((entry) => entry.isValidationPending);
    const validationOk = summary.failed === 0 && collectionState.errors.length === 0 && !isValidationPending;
    let uploadBtnVisible = false;
    let allDone = false;
    let doneBtnEnabled = false;

    const readyToUpload = summary.total - summary.succeed - summary.uploading - summary.failed;
    if (readyToUpload > 0 && fitCountRestrictions && validationOk) {
      uploadBtnVisible = true;
    } else {
      allDone = true;
      const groupOk = this.cfg.groupOutput ? !!collectionState.group : true;
      doneBtnEnabled = summary.total === summary.succeed && fitCountRestrictions && validationOk && groupOk;
    }

    this.set$({
      doneBtnVisible: allDone,
      doneBtnEnabled: doneBtnEnabled,

      uploadBtnVisible,

      addMoreBtnEnabled: summary.total === 0 || (!tooMany && !exact),
      addMoreBtnVisible: !exact || this.cfg.multiple,

      hasFiles: summary.total > 0,
    });

    this.bindL10n('headerText', () => this._getHeaderText(summary));
  }

  private _getHeaderText(summary: Summary): string {
    const localizedText = (status: keyof Summary) => {
      let count = summary[status];
      if (status === 'uploading') {
        count += summary.validatingBeforeUploading;
      }
      return this.l10n(`header-${status}`, {
        count: count,
      });
    };
    if (summary.uploading > 0 || summary.validatingBeforeUploading > 0) {
      return localizedText('uploading');
    }
    if (summary.failed > 0) {
      return localizedText('failed');
    }
    if (summary.succeed > 0) {
      return localizedText('succeed');
    }

    return localizedText('total');
  }

  override get couldOpenActivity(): boolean {
    return this.cfg.showEmptyList || this.uploadCollection.size > 0;
  }

  override initCallback() {
    super.initCallback();

    this.registerActivity(this.activityType);

    this.subConfigValue('multiple', this._throttledHandleCollectionUpdate);
    this.subConfigValue('multipleMin', this._throttledHandleCollectionUpdate);
    this.subConfigValue('multipleMax', this._throttledHandleCollectionUpdate);
    this.sub('*groupInfo', (groupInfo) => {
      if (groupInfo) {
        this._throttledHandleCollectionUpdate();
      }
    });

    this.subConfigValue('filesViewMode', (mode: FilesViewMode) => {
      this.setAttribute('mode', mode);
    });

    this.sub('*currentActivity', (currentActivity) => {
      if (!this.couldOpenActivity && currentActivity === this.activityType) {
        this.$['*currentActivity'] = this.initActivity;
      }
    });

    // TODO: could be performance issue on many files
    // there is no need to update buttons state on every progress tick
    this.uploadCollection.observeProperties(this._throttledHandleCollectionUpdate);
    this.uploadCollection.observeCollection(this._throttledHandleCollectionUpdate);

    this.sub('*collectionErrors', (errors: OutputError<OutputCollectionErrorType>[]) => {
      const firstError = errors.filter((err) => err.type !== 'SOME_FILES_HAS_ERRORS')[0];
      if (!firstError) {
        this.set$({
          commonErrorMessage: null,
        });
        return;
      }
      this.set$({
        commonErrorMessage: firstError.message,
      });
    });
  }

  override destroyCallback() {
    super.destroyCallback();
    this.uploadCollection.unobserveProperties(this._throttledHandleCollectionUpdate);
    this.uploadCollection.unobserveCollection(this._throttledHandleCollectionUpdate);
  }
}

UploadList.template = html`
  <uc-activity-header>
    <span aria-live="polite" class="uc-header-text">{{headerText}}</span>
    <button
      type="button"
      class="uc-mini-btn uc-close-btn"
      bind="onclick: *closeModal"
      l10n="@title:a11y-activity-header-button-close;@aria-label:a11y-activity-header-button-close"
    >
      <uc-icon name="close"></uc-icon>
    </button>
  </uc-activity-header>

  <div class="uc-no-files" bind="@hidden: hasFiles">
    <slot name="empty"><span l10n="no-files"></span></slot>
  </div>

  <div class="uc-files">
    <div class="uc-files-wrapper" itemize="*uploadList" item-tag="uc-file-item"></div>
    <button
      type="button"
      class="uc-add-more-btn uc-secondary-btn"
      bind="onclick: onAdd; @disabled: !addMoreBtnEnabled; @hidden: !addMoreBtnVisible"
    >
      <uc-icon name="add"></uc-icon><span l10n="add-more"></span>
    </button>
  </div>

  <div class="uc-common-error" bind="@hidden: !commonErrorMessage; textContent: commonErrorMessage;"></div>

  <div class="uc-toolbar">
    <button type="button" class="uc-cancel-btn uc-secondary-btn" bind="onclick: onCancel;" l10n="clear"></button>
    <div class="uc-toolbar-spacer"></div>
    <button
      type="button"
      class="uc-add-more-btn uc-secondary-btn"
      bind="onclick: onAdd; @disabled: !addMoreBtnEnabled; @hidden: !addMoreBtnVisible"
    >
      <uc-icon name="add"></uc-icon><span l10n="add-more"></span>
    </button>
    <button
      type="button"
      class="uc-upload-btn uc-primary-btn"
      bind="@hidden: !uploadBtnVisible; onclick: onUpload;"
      l10n="upload"
    ></button>
    <button
      type="button"
      class="uc-done-btn uc-primary-btn"
      bind="@hidden: !doneBtnVisible; onclick: onDone;  @disabled: !doneBtnEnabled"
      l10n="done"
    ></button>
  </div>

  <uc-drop-area ghost></uc-drop-area>
`;
