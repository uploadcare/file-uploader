// @ts-check
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { UiMessage } from '../MessageBox/MessageBox.js';
import { EventType } from '../UploadCtxProvider/EventEmitter.js';
import { debounce } from '../utils/debounce.js';

/**
 * @typedef {{
 *   total: number;
 *   succeed: number;
 *   uploading: number;
 *   failed: number;
 *   limitOverflow: number;
 * }} Summary
 */

export class UploadList extends UploaderBlock {
  historyTracked = true;
  activityType = ActivityBlock.activities.UPLOAD_LIST;

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

      hasFiles: false,
      onAdd: () => {
        this.initFlow(true);
      },
      onUpload: () => {
        this.uploadAll();
        this._updateUploadsState();
      },
      onDone: () => {
        this.doneFlow();
      },
      onCancel: () => {
        let data = this.getOutputData((dataItem) => {
          return !!dataItem.getValue('fileInfo');
        });
        this.emit(EventType.REMOVE, data, { debounce: true });
        this.uploadCollection.clearAll();
      },
    };
  }

  _debouncedHandleCollectionUpdate = debounce(() => {
    if (!this.isConnected) {
      return;
    }
    this._updateUploadsState();
    this._updateCountLimitMessage();

    if (!this.couldOpenActivity && this.$['*currentActivity'] === this.activityType) {
      this.historyBack();
    }
  }, 0);

  /**
   * @private
   * @returns {{ passed: Boolean; tooFew: Boolean; tooMany: Boolean; exact: Boolean; min: Number; max: Number }}
   */
  _validateFilesCount() {
    let multiple = !!this.cfg.multiple;
    let min = multiple ? this.cfg.multipleMin ?? 0 : 1;
    let max = multiple ? this.cfg.multipleMax ?? 0 : 1;
    let count = this.uploadCollection.size;

    let tooFew = min ? count < min : false;
    let tooMany = max ? count > max : false;
    let passed = !tooFew && !tooMany;
    let exact = max === count;

    return {
      passed,
      tooFew,
      tooMany,
      min,
      max,
      exact,
    };
  }

  /** @private */
  _updateCountLimitMessage() {
    let filesCount = this.uploadCollection.size;
    let countValidationResult = this._validateFilesCount();
    if (filesCount && !countValidationResult.passed) {
      let msg = new UiMessage();
      let textKey = countValidationResult.tooFew
        ? 'files-count-limit-error-too-few'
        : 'files-count-limit-error-too-many';
      msg.caption = this.l10n('files-count-limit-error-title');
      msg.text = this.l10n(textKey, {
        min: countValidationResult.min,
        max: countValidationResult.max,
        total: filesCount,
      });
      msg.isError = true;
      this.set$({
        '*message': msg,
      });
    } else {
      this.set$({
        '*message': null,
      });
    }
  }

  /** @private */
  _updateUploadsState() {
    let itemIds = this.uploadCollection.items();
    let filesCount = itemIds.length;
    /** @type {Summary} */
    let summary = {
      total: filesCount,
      succeed: 0,
      uploading: 0,
      failed: 0,
      limitOverflow: 0,
    };
    for (let id of itemIds) {
      let item = this.uploadCollection.read(id);
      if (item.getValue('fileInfo') && !item.getValue('validationErrorMsg')) {
        summary.succeed += 1;
      }
      if (item.getValue('isUploading')) {
        summary.uploading += 1;
      }
      if (item.getValue('validationErrorMsg') || item.getValue('uploadError')) {
        summary.failed += 1;
      }
      if (item.getValue('validationMultipleLimitMsg')) {
        summary.limitOverflow += 1;
      }
    }
    const { passed: fitCountRestrictions, tooMany, exact } = this._validateFilesCount();
    const validationOk = summary.failed === 0 && summary.limitOverflow === 0;
    let uploadBtnVisible = false;
    let allDone = false;
    let doneBtnEnabled = false;

    const readyToUpload = summary.total - summary.succeed - summary.uploading - summary.failed;
    if (readyToUpload > 0 && fitCountRestrictions) {
      uploadBtnVisible = true;
    } else {
      allDone = true;
      doneBtnEnabled = summary.total === summary.succeed && fitCountRestrictions && validationOk;
    }

    this.set$({
      doneBtnVisible: allDone,
      doneBtnEnabled: doneBtnEnabled,

      uploadBtnVisible,

      addMoreBtnEnabled: summary.total === 0 || (!tooMany && !exact),
      addMoreBtnVisible: !exact || this.cfg.multiple,

      headerText: this._getHeaderText(summary),
    });
  }

  /**
   * @private
   * @param {Summary} summary
   */
  _getHeaderText(summary) {
    /** @param {keyof Summary} status */
    const localizedText = (status) => {
      const count = summary[status];
      return this.l10n(`header-${status}`, {
        count: count,
      });
    };
    if (summary.uploading > 0) {
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

  get couldOpenActivity() {
    return this.cfg.showEmptyList || this.uploadCollection.size > 0;
  }

  initCallback() {
    super.initCallback();

    this.registerActivity(this.activityType);

    this.subConfigValue('multiple', this._debouncedHandleCollectionUpdate);
    this.subConfigValue('multipleMin', this._debouncedHandleCollectionUpdate);
    this.subConfigValue('multipleMax', this._debouncedHandleCollectionUpdate);

    this.sub('*currentActivity', (currentActivity) => {
      if (!this.couldOpenActivity && currentActivity === this.activityType) {
        this.$['*currentActivity'] = this.initActivity;
      }
    });

    // TODO: could be performance issue on many files
    // there is no need to update buttons state on every progress tick
    this.uploadCollection.observeProperties(this._debouncedHandleCollectionUpdate);

    this.sub('*uploadList', (list) => {
      this._debouncedHandleCollectionUpdate();

      this.set$({
        hasFiles: list.length > 0,
      });

      if (!this.cfg.confirmUpload) {
        this.add$(
          {
            '*uploadTrigger': {},
          },
          true
        );
      }
    });
  }

  destroyCallback() {
    super.destroyCallback();
    this.uploadCollection.unobserveProperties(this._debouncedHandleCollectionUpdate);
  }
}

UploadList.template = /* HTML */ `
  <lr-activity-header>
    <span class="header-text">{{headerText}}</span>
    <button type="button" class="mini-btn close-btn" set="onclick: *closeModal">
      <lr-icon name="close"></lr-icon>
    </button>
  </lr-activity-header>

  <div class="no-files" set="@hidden: hasFiles">
    <slot name="empty"><span l10n="no-files"></span></slot>
  </div>

  <div class="files" repeat="*uploadList" repeat-item-tag="lr-file-item"></div>

  <div class="toolbar">
    <button type="button" class="cancel-btn secondary-btn" set="onclick: onCancel;" l10n="clear"></button>
    <div class="toolbar-spacer"></div>
    <button
      type="button"
      class="add-more-btn secondary-btn"
      set="onclick: onAdd; @disabled: !addMoreBtnEnabled; @hidden: !addMoreBtnVisible"
    >
      <lr-icon name="add"></lr-icon><span l10n="add-more"></span>
    </button>
    <button
      type="button"
      class="upload-btn primary-btn"
      set="@hidden: !uploadBtnVisible; onclick: onUpload;"
      l10n="upload"
    ></button>
    <button
      type="button"
      class="done-btn primary-btn"
      set="@hidden: !doneBtnVisible; onclick: onDone;  @disabled: !doneBtnEnabled"
      l10n="done"
    ></button>
  </div>

  <lr-drop-area ghost></lr-drop-area>
`;
