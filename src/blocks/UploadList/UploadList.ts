import { html, type PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import { CollectionStateController } from '../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { ActivityChildBlock } from '../../lit/ActivityChildBlock';
import { ACTIVITY_TYPES } from '../../lit/activity-constants';
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
  // Includes `RouterController` (the base `ActivityChildBlock` declares it for
  // its `[active]` toggle) alongside the controllers this block reads directly:
  // `ConfigController` (tracked `filesViewMode` host attr + imperative
  // derived-state reads), `CollectionStateController` (tracked `uploadList` /
  // `collectionErrors` render reads), `TelemetryManager` (add-more / clear-all
  // action events).
  public static override readonly uses = [
    ConfigController,
    CollectionStateController,
    RouterController,
    TelemetryManager,
  ] as const;

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
  private _hasFiles = false;

  @state()
  private _latestSummary: Summary | null = null;

  private get _headerText() {
    if (!this._latestSummary) {
      return '';
    }
    return this._getHeaderText(this._latestSummary);
  }

  /**
   * Tracked getter: the common (collection-level) error message, derived from
   * `collectionErrors` (owned by `CollectionStateController`). Reading it via
   * `getTracked` in `render()` auto-tracks under `SignalWatcher`, so a
   * collection-error change re-renders — replacing the v1
   * `ctx.sub('*collectionErrors')` subscription that mirrored the first
   * non-`SOME_FILES_HAS_ERRORS` error into a `_commonErrorMessage` @state.
   */
  private get _commonErrorMessage(): string | null {
    const errors = this.use(CollectionStateController).getTracked('collectionErrors');
    const firstError = errors.filter((err) => err.type !== 'SOME_FILES_HAS_ERRORS')[0];
    return firstError?.message ?? null;
  }

  private _handleAdd = (): void => {
    this.use(TelemetryManager).sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'add-more',
          node: this.tagName,
        },
      },
    });
    // `api` (UploaderPublicApi) has no DI token (set via `UploaderController.setApi`),
    // so it stays on the v1 `bag` path (step 8).
    this.bag.api.initFlow(true);
  };

  private _handleUpload = (): void => {
    this.emit(EventType.UPLOAD_CLICK);
    // `api` has no DI token — stays on the v1 `bag` path (step 8).
    this.bag.api.uploadAll();
    this._throttledHandleCollectionUpdate();
  };

  private _handleDone = (): void => {
    // `api` has no DI token — stays on the v1 `bag` path (step 8).
    this.emit(EventType.DONE_CLICK, this.bag.api.getOutputCollectionState());
    this.bag.api.doneFlow();
  };

  private _handleCancel = (): void => {
    this.use(TelemetryManager).sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'clear-all',
          node: this.tagName,
        },
      },
    });

    // `uploadCollection` has no DI token (registration race) — stays on the v1
    // `bag` path (step 8).
    this.bag.uploadCollection.clearAll();
  };

  // A trailing tick can fire after the block is released while still connected
  // (registry unregistration race) — read the controller null-tolerantly and
  // bail rather than throwing uncaught in the timeout (DynamicBtn precedent).
  private _throttledHandleCollectionUpdate = throttle(() => {
    const uploader = this.uploaderOrNull;
    if (!this.isConnected || !uploader) {
      return;
    }
    this._updateUploadsState();

    // The router guard (registered in controllerReady) decides whether the empty
    // list may stay open; ask it to re-check now that the collection changed.
    this.bag.routerOrNull?.revalidate();

    if (!uploader.config.get('confirmUpload')) {
      this.bag.apiOrNull?.uploadAll();
    }
  }, 300);

  private _updateUploadsState(): void {
    // Imperative derived-state recompute (writes the toolbar/button `@state`
    // below), not a render read — runs only from the throttled tick after its
    // `!uploader` guard, so the container is adopted and `use()` is safe. Config
    // reads use the untracked `get()` (a re-render is driven by the throttled
    // tick's `subConfigValue`/collection observers, not by tracking here);
    // `api` has no DI token so `getOutputCollectionState` stays on `bag` (step 8).
    const config = this.use(ConfigController);
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
    const multiple = config.get('multiple');
    const exact = collectionState.totalCount === (multiple ? config.get('multipleMax') : 1);
    const isValidationPending = collectionState.allEntries.some((entry) => entry.isValidationPending);
    const validationOk = summary.failed === 0 && collectionState.errors.length === 0 && !isValidationPending;
    let uploadBtnVisible = false;
    let allDone = false;
    let doneBtnEnabled = false;

    const readyToUpload = summary.total - summary.succeed - summary.uploading - summary.failed;
    if (readyToUpload > 0 && fitCountRestrictions && validationOk && config.get('confirmUpload')) {
      uploadBtnVisible = true;
    } else {
      allDone = true;
      const groupOk = config.get('groupOutput') ? !!collectionState.group : true;
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

  protected override controllerReady(ctrl: UploaderController): void {
    super.controllerReady(ctrl);

    // Guard: the upload list may only be open while it has files (or
    // `showEmptyList`). The router blocks navigating into it otherwise and
    // `revalidate()` (called on collection changes) leaves it once it empties.
    // `uploadCollection` may not have registered yet when this guard is later
    // invoked by the router (FileItem/DynamicBtn `bag.when`/`OrNull` precedent
    // for the adoption-reentrancy race) — read it null-tolerantly. Tracked
    // like the other subscriptions below so teardown is uniform (release-time,
    // not just disconnect) and the predicate itself reads the controller
    // non-throwingly so a teardown-time navigation can't warn spuriously.
    // The guard registration goes through `use(RouterController)` (container is
    // adopted by `controllerReady`), but the predicate keeps its null-tolerant
    // `uploaderOrNull`/`bag.uploadCollectionOrNull` reads — it can fire during a
    // teardown-time navigation, after the container is released, where `use()`
    // would throw.
    this.trackSub(
      this.use(RouterController).guard(
        this.activityType,
        () =>
          (this.uploaderOrNull?.config.get('showEmptyList') ?? false) ||
          (this.bag.uploadCollectionOrNull?.size ?? 0) > 0,
      ),
    );

    // Imperative derived-state triggers (kept on the v1 `subConfigValue`/`ctx.sub`
    // path, step 8): these don't feed `render()` directly — they re-run
    // `_updateUploadsState` (which writes the toolbar/button `@state`) on a config
    // or group change. A tracked read can't replace them because that recompute
    // runs outside the `SignalWatcher` update cycle, so it wouldn't auto-track.
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

    // TODO: could be performance issue on many files
    // there is no need to update buttons state on every progress tick
    //
    // The uploader-scope `*uploadCollection` instance may not have registered
    // yet when this block's controller adopts — go through `bag.when` rather
    // than the throwing `bag.uploadCollection` getter (FileItem/DynamicBtn
    // precedent), and track the observer unsubscribers so release/re-adoption
    // can't stack duplicate observers. `uploadCollection` has no DI token
    // (registration race) so this stays on the v1 `bag` path (step 8).
    this.trackSub(
      this.bag.when('uploadCollection', (collection) => {
        this.trackSub(collection.observeProperties(this._throttledHandleCollectionUpdate));
        this.trackSub(collection.observeCollection(this._throttledHandleCollectionUpdate));
      }),
    );
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    // Host CSS attribute: `uc-upload-list[mode="grid"]` keys off `mode` ON THE
    // HOST (grid/list box sizing), so drive it there from the tracked config
    // signal (the Modal/Copyright `willUpdate` + `getTracked` host-attr recipe).
    // Reading `filesViewMode` via `getTracked` auto-tracks under `SignalWatcher`,
    // so a config change re-runs this update and re-sets the attribute — matching
    // the reactivity of the v1 `subConfigValue('filesViewMode')` it replaces.
    // This block has no lazy-render gate (unlike FileItem's `_pauseRender`, which
    // is why FileItem keeps its `mode` host attr imperative), so `willUpdate`
    // runs on the first post-adoption render — before first paint, matching v1's
    // eager `subConfigValue` fire. `mode` is not a reactive property, so setting
    // it schedules no further update.
    this.setAttribute('mode', this.use(ConfigController).getTracked('filesViewMode'));
  }

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [(listener: () => void) => ctrl.locale.subscribe(listener)];
  }

  public override render() {
    // Tracked render reads: `uploadList` drives the `<uc-file-item>` list and
    // `collectionErrors` (via `_commonErrorMessage`) drives the common-error row —
    // both `getTracked` off `CollectionStateController`, auto-tracked under
    // `SignalWatcher`, so a collection change re-renders with no `ctx.sub`.
    const uploadList = this.use(CollectionStateController).getTracked('uploadList');
    const commonErrorMessage = this._commonErrorMessage;
    return html`
  <uc-activity-header>
    <span aria-live="polite" class="uc-header-text">${this._headerText}</span>
    <button
      type="button"
      class="uc-mini-btn uc-close-btn"
      @click=${() => this.use(RouterController).traverse('onClose')}
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
      uploadList,
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
  ?hidden=${!commonErrorMessage}
  >
  ${commonErrorMessage ?? ''}
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
