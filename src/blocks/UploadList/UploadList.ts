import { html } from 'lit';
import { state } from 'lit/decorators.js';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import { ActivityChildBlock } from '../../lit/ActivityChildBlock';
import { ACTIVITY_TYPES } from '../../lit/activity-constants';
import type { OutputCollectionErrorType, OutputError } from '../../types';
import { throttle } from '../../utils/throttle';
import { EventType, InternalEventType } from '../UploadCtxProvider/EventEmitter';
import './upload-list.css';
import { repeat } from 'lit/directives/repeat.js';

import '../ActivityHeader/ActivityHeader';
import '../Icon/Icon';
import '../FileItem/FileItem';
import '../DropArea/DropArea';

export type FilesViewMode = 'grid' | 'list';

export type Summary = {
  total: number;
  succeed: number;
  uploading: number;
  failed: number;
  validatingBeforeUploading: number;
};

export class UploadList extends ActivityChildBlock {
  public override activityType = ACTIVITY_TYPES.UPLOAD_LIST;

  @state()
  private _doneBtnVisible = false;

  @state()
  private _doneBtnEnabled = false;

  @state()
  private _uploadBtnVisible = false;

  @state()
  private _addMoreBtnVisible = false;

  @state()
  private _addMoreBtnEnabled = false;

  @state()
  private _commonErrorMessage: string | null = null;

  @state()
  private _hasFiles = false;

  @state()
  private _latestSummary: Summary | null = null;

  private get _headerText() {
    if (!this._latestSummary) {
      return '';
    }
    return this._getHeaderText(this._latestSummary);
  }

  private _handleAdd = (): void => {
    this.bag.telemetryManager.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'add-more',
          node: this.tagName,
        },
      },
    });
    this.bag.api.initFlow(true);
  };

  private _handleUpload = (): void => {
    this.emit(EventType.UPLOAD_CLICK);
    this.bag.api.uploadAll();
    this._throttledHandleCollectionUpdate();
  };

  private _handleDone = (): void => {
    this.emit(EventType.DONE_CLICK, this.bag.api.getOutputCollectionState());
    this.bag.api.doneFlow();
  };

  private _handleCancel = (): void => {
    this.bag.telemetryManager.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'clear-all',
          node: this.tagName,
        },
      },
    });

    this.bag.uploadCollection.clearAll();
  };

  private _throttledHandleCollectionUpdate = throttle(() => {
    if (!this.isConnected) {
      return;
    }
    this._updateUploadsState();

    // The router guard (registered in controllerReady) decides whether the empty
    // list may stay open; ask it to re-check now that the collection changed.
    this.bag.router.revalidate();

    if (!this.uploader.config.get('confirmUpload')) {
      this.bag.api.uploadAll();
    }
  }, 300);

  private _updateUploadsState(): void {
    const collectionState = this.bag.api.getOutputCollectionState();
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
    const multiple = this.uploader.config.get('multiple');
    const exact = collectionState.totalCount === (multiple ? this.uploader.config.get('multipleMax') : 1);
    const isValidationPending = collectionState.allEntries.some((entry) => entry.isValidationPending);
    const validationOk = summary.failed === 0 && collectionState.errors.length === 0 && !isValidationPending;
    let uploadBtnVisible = false;
    let allDone = false;
    let doneBtnEnabled = false;

    const readyToUpload = summary.total - summary.succeed - summary.uploading - summary.failed;
    if (readyToUpload > 0 && fitCountRestrictions && validationOk && this.uploader.config.get('confirmUpload')) {
      uploadBtnVisible = true;
    } else {
      allDone = true;
      const groupOk = this.uploader.config.get('groupOutput') ? !!collectionState.group : true;
      doneBtnEnabled = summary.total === summary.succeed && fitCountRestrictions && validationOk && groupOk;
    }

    this._doneBtnVisible = allDone;
    this._doneBtnEnabled = doneBtnEnabled;
    this._uploadBtnVisible = uploadBtnVisible;
    this._addMoreBtnEnabled = summary.total === 0 || (!tooMany && !exact);
    this._addMoreBtnVisible = !exact || multiple;
    this._hasFiles = summary.total > 0;

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

  private _unregisterGuard?: () => void;

  protected override controllerReady(ctrl: UploaderController): void {
    super.controllerReady(ctrl);

    // Guard: the upload list may only be open while it has files (or
    // `showEmptyList`). The router blocks navigating into it otherwise and
    // `revalidate()` (called on collection changes) leaves it once it empties.
    // `uploadCollection` may not have registered yet when this guard is later
    // invoked by the router (FileItem/DynamicBtn `bag.when`/`OrNull` precedent
    // for the adoption-reentrancy race) — read it null-tolerantly.
    this._unregisterGuard = this.bag.router.guard(
      this.activityType,
      () => this.uploader.config.get('showEmptyList') || (this.bag.uploadCollectionOrNull?.size ?? 0) > 0,
    );

    this.subConfigValue('multiple', this._throttledHandleCollectionUpdate);
    this.subConfigValue('multipleMin', this._throttledHandleCollectionUpdate);
    this.subConfigValue('multipleMax', this._throttledHandleCollectionUpdate);
    this.trackSub(
      this.bag.ctx.sub('*groupInfo', (groupInfo) => {
        if (groupInfo) {
          this._throttledHandleCollectionUpdate();
        }
      }),
    );

    this.subConfigValue('filesViewMode', (mode: FilesViewMode) => {
      this.setAttribute('mode', mode);
    });

    // TODO: could be performance issue on many files
    // there is no need to update buttons state on every progress tick
    //
    // The uploader-scope `*uploadCollection` instance may not have registered
    // yet when this block's controller adopts — go through `bag.when` rather
    // than the throwing `bag.uploadCollection` getter (FileItem/DynamicBtn
    // precedent), and track the observer unsubscribers so release/re-adoption
    // can't stack duplicate observers.
    this.trackSub(
      this.bag.when('uploadCollection', (collection) => {
        this.trackSub(collection.observeProperties(this._throttledHandleCollectionUpdate));
        this.trackSub(collection.observeCollection(this._throttledHandleCollectionUpdate));
      }),
    );

    this.trackSub(
      this.bag.ctx.sub('*collectionErrors', (errors: OutputError<OutputCollectionErrorType>[]) => {
        const firstError = errors.filter((err) => err.type !== 'SOME_FILES_HAS_ERRORS')[0];
        if (!firstError) {
          this._commonErrorMessage = null;
          return;
        }
        this._commonErrorMessage = firstError.message;
      }),
    );
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unregisterGuard?.();
    this._unregisterGuard = undefined;
  }

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [(listener: () => void) => ctrl.locale.subscribe(listener)];
  }

  public override render() {
    return html`
  <uc-activity-header>
    <span aria-live="polite" class="uc-header-text">${this._headerText}</span>
    <button
      type="button"
      class="uc-mini-btn uc-close-btn"
      @click=${() => this.bag.router.traverse('onClose')}
      title=${this.l10n('a11y-activity-header-button-close')}
      aria-label=${this.l10n('a11y-activity-header-button-close')}
    >
      <uc-icon name="close"></uc-icon>
    </button>
  </uc-activity-header>

  <div class="uc-no-files" ?hidden=${this._hasFiles}>
    ${this.yield('empty', html`<span>${this.l10n('no-files')}</span>`)}
  </div>

  <div class="uc-files">
    <div class="uc-files-wrapper">
    ${repeat(
      this.bag.ctx.read('*uploadList') ?? [],
      ({ uid }) => uid,
      ({ uid }) => html`<uc-file-item .uid=${uid}></uc-file-item>`,
    )}
    </div>
    <button
      type="button"
      class="uc-add-more-btn uc-secondary-btn"
      @click=${this._handleAdd}
      ?disabled=${!this._addMoreBtnEnabled}
      ?hidden=${!this._addMoreBtnVisible}
    >
      <uc-icon name="add"></uc-icon><span>${this.l10n('add-more')}</span>
    </button>
  </div>

  <div class="uc-common-error"
  ?hidden=${!this._commonErrorMessage}
  >
  ${this._commonErrorMessage ?? ''}
  </div>

  <div class="uc-toolbar">
    <button type="button" class="uc-cancel-btn uc-secondary-btn" @click=${this._handleCancel}>${this.l10n('clear')}</button>
    <div class="uc-toolbar-spacer"></div>
    <button
      type="button"
      class="uc-add-more-btn uc-secondary-btn"
      ?hidden=${!this._addMoreBtnVisible}
      ?disabled=${!this._addMoreBtnEnabled}
      @click=${this._handleAdd}
    >
      <uc-icon name="add"></uc-icon><span>${this.l10n('add-more')}</span>
    </button>
    <button
      type="button"
      class="uc-upload-btn uc-primary-btn"
      ?hidden=${!this._uploadBtnVisible}
      @click=${this._handleUpload}
    >${this.l10n('upload')}</button>
    <button
      type="button"
      class="uc-done-btn uc-primary-btn"
      ?hidden=${!this._doneBtnVisible}
      ?disabled=${!this._doneBtnEnabled}
      @click=${this._handleDone}
    >
      ${this.l10n('done')}
    </button>
  </div>

  <uc-drop-area ghost></uc-drop-area>
`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-upload-list': UploadList;
  }
}
