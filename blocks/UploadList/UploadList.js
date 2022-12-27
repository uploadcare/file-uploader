import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { UiMessage } from '../MessageBox/MessageBox.js';
import { EVENT_TYPES, EventData, EventManager } from '../../abstract/EventManager.js';
import { debounce } from '../utils/debounce.js';

export class UploadList extends UploaderBlock {
  historyTracked = true;
  activityType = ActivityBlock.activities.UPLOAD_LIST;

  init$ = {
    ...this.ctxInit,
    doneBtnVisible: false,
    doneBtnEnabled: false,
    uploadBtnVisible: false,
    uploadBtnEnabled: false,
    addMoreBtnVisible: false,
    addMoreBtnEnabled: false,
    headerText: '',

    hasFiles: false,
    onAdd: () => {
      this.initFlow(true);
    },
    onUpload: () => {
      this.$['*uploadTrigger'] = {};
      this._updateUploadsState();
    },
    onDone: () => {
      this.cancelFlow();
    },
    onCancel: () => {
      let data = this.getOutputData((dataItem) => {
        return !!dataItem.getValue('uuid');
      });
      EventManager.emit(
        new EventData({
          type: EVENT_TYPES.REMOVE,
          ctx: this.ctxName,
          data,
        })
      );
      this.uploadCollection.clearAll();
    },
  };

  cssInit$ = {
    '--cfg-show-empty-list': 0,
    '--cfg-multiple': 1,
    '--cfg-multiple-min': 0,
    '--cfg-multiple-max': 0,
    '--cfg-confirm-upload': 1,
    '--cfg-source-list': '',
  };

  _debouncedHandleCollectionUpdate = debounce(() => {
    this._updateUploadsState();
    this._updateCountLimitMessage();
  }, 0);

  /**
   * @private
   * @returns {{ passed: Boolean; tooFew: Boolean; tooMany: Boolean; exact: Boolean; min: Number; max: Number }}
   */
  _validateFilesCount() {
    let multiple = !!this.getCssData('--cfg-multiple');
    let min = multiple ? this.getCssData('--cfg-multiple-min') ?? 0 : 1;
    let max = multiple ? this.getCssData('--cfg-multiple-max') ?? 0 : 1;
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
    }
  }

  /** @private */
  _updateUploadsState() {
    let itemIds = this.uploadCollection.items();
    let filesCount = itemIds.length;
    let summary = {
      total: filesCount,
      succeed: 0,
      uploading: 0,
      failed: 0,
    };
    for (let id of itemIds) {
      let item = this.uploadCollection.read(id);
      if (item.getValue('uuid') && !item.getValue('validationErrorMsg')) {
        summary.succeed += 1;
      }
      if (item.getValue('isUploading')) {
        summary.uploading += 1;
      }
      if (item.getValue('validationErrorMsg') || item.getValue('uploadError')) {
        summary.failed += 1;
      }
    }
    let allDone = summary.total === summary.succeed + summary.failed;
    let { passed: fitCountRestrictions, tooMany, exact } = this._validateFilesCount();
    let fitValidation = summary.failed === 0;

    let doneBtnEnabled = summary.total > 0 && fitCountRestrictions && fitValidation;
    let uploadBtnEnabled =
      summary.total - summary.succeed - summary.uploading - summary.failed > 0 && fitCountRestrictions;

    this.set$({
      doneBtnVisible: allDone,
      doneBtnEnabled: doneBtnEnabled,

      uploadBtnVisible: !allDone,
      uploadBtnEnabled,

      addMoreBtnEnabled: summary.total === 0 || (!tooMany && !exact),
      addMoreBtnVisible: !exact || this.getCssData('--cfg-multiple'),

      headerText: this._getHeaderText(summary),
    });
  }

  /** @private */
  _getHeaderText(summary) {
    if (summary.uploading > 0) {
      return `Uploading ${summary.uploading} files`;
    }
    if (summary.failed > 0) {
      return `${summary.failed} errors`;
    }
    if (summary.succeed > 0) {
      return `${summary.succeed} files uploaded`;
    }

    return `${summary.total} files selected`;
  }

  initCallback() {
    super.initCallback();

    this.registerActivity(this.activityType);

    this.sub('--cfg-multiple', this._debouncedHandleCollectionUpdate);
    this.sub('--cfg-multiple-min', this._debouncedHandleCollectionUpdate);
    this.sub('--cfg-multiple-max', this._debouncedHandleCollectionUpdate);

    this.sub('*currentActivity', (currentActivity) => {
      if (
        this.uploadCollection?.size === 0 &&
        !this.getCssData('--cfg-show-empty-list') &&
        currentActivity === this.activityType
      ) {
        this.$['*currentActivity'] = this.initActivity;
      }
    });

    // TODO: could be performance issue on many files
    // there is no need to update buttons state on every progress tick
    this.uploadCollection.observe(this._debouncedHandleCollectionUpdate);

    this.sub('*uploadList', (list) => {
      this._debouncedHandleCollectionUpdate();

      this.set$({
        hasFiles: list.length > 0,
      });

      if (list?.length === 0 && !this.getCssData('--cfg-show-empty-list')) {
        this.historyBack();
      }
    });
  }

  destroyCallback() {
    super.destroyCallback();
    this.uploadCollection.unobserve(this._debouncedHandleCollectionUpdate);
  }
}

UploadList.template = /* HTML */ `
  <lr-activity-header>
    <span>{{headerText}}</span>
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
      set="@hidden: !uploadBtnVisible; onclick: onUpload; @disabled: !uploadBtnEnabled"
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
