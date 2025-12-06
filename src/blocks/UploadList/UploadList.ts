import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { LitActivityBlock } from '../../lit/LitActivityBlock';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import type { OutputCollectionErrorType, OutputError } from '../../types';
import { throttle } from '../../utils/throttle';
import { EventType, InternalEventType } from '../UploadCtxProvider/EventEmitter';
import './upload-list.css';
import { repeat } from 'lit/directives/repeat.js';

export type FilesViewMode = 'grid' | 'list';

export type Summary = {
  total: number;
  succeed: number;
  uploading: number;
  failed: number;
  validatingBeforeUploading: number;
};

export class UploadList extends LitUploaderBlock {
  public override couldBeCtxOwner = true;
  protected override historyTracked = true;
  public override activityType = LitActivityBlock.activities.UPLOAD_LIST;

  @state()
  private doneBtnVisible = false;

  @state()
  private doneBtnEnabled = false;

  @state()
  private uploadBtnVisible = false;

  @state()
  private addMoreBtnVisible = false;

  @state()
  private addMoreBtnEnabled = false;

  @state()
  private commonErrorMessage: string | null = null;

  @state()
  private hasFiles = false;

  @state()
  private _latestSummary: Summary | null = null;
  protected get headerText() {
    if (!this._latestSummary) {
      return '';
    }
    return this._getHeaderText(this._latestSummary);
  }

  private _handleAdd = (): void => {
    this.telemetryManager.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'add-more',
          node: this.tagName,
        },
      },
    });
    this.api.initFlow(true);
  };

  private _handleUpload = (): void => {
    this.emit(EventType.UPLOAD_CLICK);
    this.api.uploadAll();
    this._throttledHandleCollectionUpdate();
  };

  private _handleDone = (): void => {
    this.emit(EventType.DONE_CLICK, this.api.getOutputCollectionState());
    this.api.doneFlow();
  };

  private _handleCancel = (): void => {
    this.telemetryManager.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'clear-all',
          node: this.tagName,
        },
      },
    });

    this.uploadCollection.clearAll();
  };

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

  protected _updateUploadsState(): void {
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
    if (readyToUpload > 0 && fitCountRestrictions && validationOk && this.cfg.confirmUpload) {
      uploadBtnVisible = true;
    } else {
      allDone = true;
      const groupOk = this.cfg.groupOutput ? !!collectionState.group : true;
      doneBtnEnabled = summary.total === summary.succeed && fitCountRestrictions && validationOk && groupOk;
    }

    this.doneBtnVisible = allDone;
    this.doneBtnEnabled = doneBtnEnabled;
    this.uploadBtnVisible = uploadBtnVisible;
    this.addMoreBtnEnabled = summary.total === 0 || (!tooMany && !exact);
    this.addMoreBtnVisible = !exact || this.cfg.multiple;
    this.hasFiles = summary.total > 0;

    this._latestSummary = summary;
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

  public override get couldOpenActivity(): boolean {
    return this.cfg.showEmptyList || this.uploadCollection.size > 0;
  }

  public override initCallback() {
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
        this.commonErrorMessage = null;
        return;
      }
      this.commonErrorMessage = firstError.message;
    });
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.has('*uploadCollection')) {
      this.uploadCollection.unobserveProperties(this._throttledHandleCollectionUpdate);
      this.uploadCollection.unobserveCollection(this._throttledHandleCollectionUpdate);
    }
  }

  public override render() {
    return html`
  <uc-activity-header>
    <span aria-live="polite" class="uc-header-text">${this.headerText}</span>
    <button
      type="button"
      class="uc-mini-btn uc-close-btn"
      @click=${this.$['*closeModal']}
      title=${this.l10n('a11y-activity-header-button-close')}
      aria-label=${this.l10n('a11y-activity-header-button-close')}
    >
      <uc-icon name="close"></uc-icon>
    </button>
  </uc-activity-header>

  <div class="uc-no-files" ?hidden=${this.hasFiles}>
    ${this.yield('empty', html`<span>${this.l10n('no-files')}</span>`)}
  </div>

  <div class="uc-files">
    <div class="uc-files-wrapper">
    ${repeat(
      this.$['*uploadList'] ?? [],
      ({ uid }) => uid,
      ({ uid }) => html`<uc-file-item .uid=${uid}></uc-file-item>`,
    )}
    </div>
    <button
      type="button"
      class="uc-add-more-btn uc-secondary-btn"
      @click=${this._handleAdd}
      ?disabled=${!this.addMoreBtnEnabled}
      ?hidden=${!this.addMoreBtnVisible}
    >
      <uc-icon name="add"></uc-icon><span>${this.l10n('add-more')}</span>
    </button>
  </div>

  <div class="uc-common-error" 
  ?hidden=${!this.commonErrorMessage}
  >
  ${this.commonErrorMessage ?? ''}
  </div>

  <div class="uc-toolbar">
    <button type="button" class="uc-cancel-btn uc-secondary-btn" @click=${this._handleCancel}>${this.l10n('clear')}</button>
    <div class="uc-toolbar-spacer"></div>
    <button
      type="button"
      class="uc-add-more-btn uc-secondary-btn"
      ?hidden=${!this.addMoreBtnVisible}
      ?disabled=${!this.addMoreBtnEnabled}
      @click=${this._handleAdd}
    >
      <uc-icon name="add"></uc-icon><span>${this.l10n('add-more')}</span>
    </button>
    <button
      type="button"
      class="uc-upload-btn uc-primary-btn"
      ?hidden=${!this.uploadBtnVisible}
      @click=${this._handleUpload}
    >${this.l10n('upload')}</button>
    <button
      type="button"
      class="uc-done-btn uc-primary-btn"
      ?hidden=${!this.doneBtnVisible}
      ?disabled=${!this.doneBtnEnabled}
      @click=${this._handleDone}
    >
      ${this.l10n('done')}
    </button>
  </div>

  <uc-drop-area ghost></uc-drop-area>
`;
  }
}
