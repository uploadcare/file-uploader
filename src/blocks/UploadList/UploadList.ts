import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../../blocks/UploadList/upload-list.css';
import '../ActivityHeader/ActivityHeader';
import '../DropArea/DropArea';
import '../FileItem/FileItem';
import '../Icon/Icon';
import { ActivityBlock } from '../../abstract/ActivityBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import { UploaderEventType } from '../../abstract/EventBus';
import type { UploadEntry } from '../../abstract/UploadEntry';
import type { OutputErrorCollection } from '../../types/exported';

/** v1-shaped re-export — `config.filesViewMode` is typed as a string in v2, but consumers still expect the literal union. */
export type FilesViewMode = 'grid' | 'list';

interface Summary {
  total: number;
  succeed: number;
  uploading: number;
  failed: number;
  validatingBeforeUploading: number;
}

/**
 * v2 `<uc-upload-list>`. Activity wrapper that lists the upload
 * collection's entries. Derives a `summary` from v2's collection
 * snapshots (each `FileOutput.status`) and toggles the toolbar buttons
 * (clear / add more / upload / done) accordingly. Activity transitions,
 * close-modal, and history-back all go through v2's router (which
 * facades to v1).
 *
 * Visual markup matches v1 exactly so `upload-list.css` styles
 * unchanged.
 */
export class UploadList extends ActivityBlock {
  public override activityType = 'upload-list';

  @state() private _doneBtnVisible = false;
  @state() private _doneBtnEnabled = false;
  @state() private _uploadBtnVisible = false;
  @state() private _addMoreBtnVisible = false;
  @state() private _addMoreBtnEnabled = false;
  @state() private _commonErrorMessage: string | null = null;
  @state() private _hasFiles = false;
  @state() private _latestSummary: Summary | null = null;

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [
      ctrl.router.subscribe.bind(ctrl.router),
      ctrl.collection.subscribe.bind(ctrl.collection),
      ctrl.config.subscribe.bind(ctrl.config),
      ctrl.locale.subscribe.bind(ctrl.locale),
      ctrl.validation.subscribe.bind(ctrl.validation),
      ctrl.upload.subscribe.bind(ctrl.upload),
    ];
  }

  private _refreshSummary(): void {
    const ctrl = this.uploaderOrNull;
    if (!ctrl) return;
    const entries = ctrl.collection.entries;
    const cfg = ctrl.config.values as {
      multiple?: boolean;
      multipleMax?: number;
      confirmUpload?: boolean;
      groupOutput?: boolean;
      showEmptyList?: boolean;
    };

    // Walk entries once, reading fields directly. Avoids snapshotting
    // each entry (≈13 getValue calls per snapshot) just to bucket them.
    let succeed = 0;
    let uploading = 0;
    let failed = 0;
    let validating = 0;
    for (const e of entries) {
      const errors = e.getValue('errors');
      if (errors.length > 0) failed += 1;
      else if (e.getValue('fileInfo')) succeed += 1;
      else if (e.getValue('isUploading') || e.getValue('isQueuedForUploading')) uploading += 1;
      else if (e.getValue('isValidationPending') || e.getValue('isQueuedForValidation')) validating += 1;
    }
    const summary: Summary = {
      total: entries.length,
      succeed,
      uploading,
      failed,
      validatingBeforeUploading: validating,
    };

    const collectionErrors: readonly OutputErrorCollection[] = ctrl.validation.collectionErrors;
    const tooMany = collectionErrors.some((e) => e.type === 'TOO_MANY_FILES');
    const fitCount = !collectionErrors.some((e) => e.type === 'TOO_MANY_FILES' || e.type === 'TOO_FEW_FILES');
    const exact = summary.total === (cfg.multiple ? (cfg.multipleMax ?? 0) : 1);
    const validationOk = summary.failed === 0 && collectionErrors.length === 0;

    const groupOk = cfg.groupOutput ? ctrl.upload.group !== null : true;

    // Surface the first non-aggregate collection error as the common
    // error banner (per-file errors live inside each FileItem).
    const firstError = collectionErrors.find((e) => e.type !== 'SOME_FILES_HAS_ERRORS');
    this._commonErrorMessage = firstError?.message ?? null;

    const readyToUpload = summary.total - summary.succeed - summary.uploading - summary.failed;
    let uploadBtnVisible = false;
    let allDone = false;
    let doneBtnEnabled = false;
    if (readyToUpload > 0 && fitCount && validationOk && cfg.confirmUpload) {
      uploadBtnVisible = true;
    } else {
      allDone = true;
      doneBtnEnabled = summary.total === summary.succeed && fitCount && validationOk && groupOk;
    }

    this._doneBtnVisible = allDone;
    this._doneBtnEnabled = doneBtnEnabled;
    this._uploadBtnVisible = uploadBtnVisible;
    this._addMoreBtnEnabled = summary.total === 0 || (!tooMany && !exact);
    this._addMoreBtnVisible = !exact || !!cfg.multiple;
    this._hasFiles = summary.total > 0;
    this._latestSummary = summary;

    // Auto-upload when confirmUpload is off and there are idle items.
    // Gate on collection errors + count fit so a failing collection
    // validator blocks the upload — v1 parity. Per-file errors are not
    // a gate; the good files should still upload while the failed ones
    // surface their own error in the file item.
    const collectionBlocking = collectionErrors.some((e) => e.type !== 'SOME_FILES_HAS_ERRORS');
    if (!cfg.confirmUpload && readyToUpload > 0 && !this._uploadBtnVisible && !collectionBlocking && fitCount) {
      void ctrl.upload.runAll();
    }

    // If we shouldn't be on this activity (empty list + !showEmptyList),
    // bounce away. Modal presets keep `upload-list` in the foreground
    // slot, so check both slots — otherwise removing the last file in
    // a regular/minimal preset leaves the modal stuck open.
    const couldOpen = cfg.showEmptyList || summary.total > 0;
    const onUploadList = ctrl.router.activity === this.activityType || ctrl.router.modal === this.activityType;
    if (!couldOpen && onUploadList) {
      ctrl.router.back();
    }
  }

  // Coalesce refreshes within a frame — many add/remove batches and
  // upload completions can land in the same tick.
  private _refreshScheduled = false;
  private _scheduleRefresh(): void {
    if (this._refreshScheduled) return;
    this._refreshScheduled = true;
    requestAnimationFrame(() => {
      this._refreshScheduled = false;
      this._refreshSummary();
    });
  }

  public override updated(changed: Map<PropertyKey, unknown>): void {
    super.updated(changed);
    this._scheduleRefresh();
    const mode = (this.uploaderOrNull?.config.values as { filesViewMode?: string })?.filesViewMode;
    if (mode) this.setAttribute('mode', mode);
  }

  private _handleClear = (): void => {
    this.uploader.api.removeAllFiles();
  };

  private _handleAdd = (): void => {
    // "Add more" always jumps to the source picker, regardless of the
    // current activity. `api.open()` would no-op here because we're
    // already on upload-list.
    this.uploader.router.navigate('start-from');
  };

  private _handleUpload = (): void => {
    // v1 fires upload-click *before* kicking off uploads.
    this.uploader.events.emit(UploaderEventType.UPLOAD_CLICK, undefined);
    void this.uploader.api.uploadAll();
  };

  private _handleDone = (): void => {
    // v1 fires done-click with the current collection state.
    this.uploader.events.emit(UploaderEventType.DONE_CLICK, this.uploader.api.getOutputCollectionState());
    this.uploader.api.close();
  };

  private _handleClose = (): void => {
    this.uploader.api.close();
  };

  private get _headerText(): string {
    const ctrl = this.uploaderOrNull;
    const s = this._latestSummary;
    if (!ctrl || !s) return '';
    const t = (key: string, vars: Record<string, unknown>): string => ctrl.locale.t(key, vars);
    if (s.uploading > 0 || s.validatingBeforeUploading > 0) {
      return t('header-uploading', { count: s.uploading + s.validatingBeforeUploading });
    }
    if (s.failed > 0) return t('header-failed', { count: s.failed });
    if (s.succeed > 0) return t('header-succeed', { count: s.succeed });
    return t('header-total', { count: s.total });
  }

  private _t(key: string): string {
    return this.uploaderOrNull?.locale.t(key) ?? key;
  }

  public override render() {
    const ctrl = this.uploaderOrNull;
    const entries: UploadEntry[] = ctrl?.collection.entries ?? [];

    return html`
      <uc-activity-header>
        <span aria-live="polite" class="uc-header-text">${this._headerText}</span>
        <button
          type="button"
          class="uc-mini-btn uc-close-btn"
          @click=${this._handleClose}
          title=${this._t('a11y-activity-header-button-close')}
          aria-label=${this._t('a11y-activity-header-button-close')}
        >
          <uc-icon name="close"></uc-icon>
        </button>
      </uc-activity-header>

      <div class="uc-no-files" ?hidden=${this._hasFiles}>
        ${this.yield('empty', html`<span>${this._t('no-files')}</span>`)}
      </div>

      <div class="uc-files">
        <div class="uc-files-wrapper">
          ${repeat(
            entries,
            (entry) => entry.internalId,
            (entry) => html`<uc-file-item .entry=${entry}></uc-file-item>`,
          )}
        </div>
        <button
          type="button"
          class="uc-add-more-btn uc-secondary-btn"
          @click=${this._handleAdd}
          ?disabled=${!this._addMoreBtnEnabled}
          ?hidden=${!this._addMoreBtnVisible}
        >
          <uc-icon name="add"></uc-icon><span>${this._t('add-more')}</span>
        </button>
      </div>

      <div class="uc-common-error" ?hidden=${!this._commonErrorMessage}>
        ${this._commonErrorMessage ?? ''}
      </div>

      <div class="uc-toolbar">
        <button
          type="button"
          class="uc-cancel-btn uc-secondary-btn"
          @click=${this._handleClear}
        >${this._t('clear')}</button>
        <div class="uc-toolbar-spacer"></div>
        <button
          type="button"
          class="uc-add-more-btn uc-secondary-btn"
          ?hidden=${!this._addMoreBtnVisible}
          ?disabled=${!this._addMoreBtnEnabled}
          @click=${this._handleAdd}
        >
          <uc-icon name="add"></uc-icon><span>${this._t('add-more')}</span>
        </button>
        <button
          type="button"
          class="uc-upload-btn uc-primary-btn"
          ?hidden=${!this._uploadBtnVisible}
          @click=${this._handleUpload}
        >${this._t('upload')}</button>
        <button
          type="button"
          class="uc-done-btn uc-primary-btn"
          ?hidden=${!this._doneBtnVisible}
          ?disabled=${!this._doneBtnEnabled}
          @click=${this._handleDone}
        >
          ${this._t('done')}
        </button>
      </div>

      <uc-drop-area ghost></uc-drop-area>
    `;
  }
}

if (!customElements.get('uc-upload-list')) customElements.define('uc-upload-list', UploadList);
