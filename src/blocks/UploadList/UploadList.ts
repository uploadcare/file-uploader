import { html, type PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import { CollectionStateController } from '../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import { deriveEntryStatus } from '../../abstract/deriveEntryStatus';
import { inject } from '../../abstract/di/inject';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { ActivityChildBlock } from '../../lit/ActivityChildBlock';
import { ACTIVITY_TYPES } from '../../lit/activity-constants';
import { throttled } from '../../lit/rate-limited-method';
import { subscription, type Unsubscribe } from '../../lit/subscription';
import { EventType, InternalEventType } from '../UploadCtxProvider/EventEmitter';
import './upload-list.css';
import { repeat } from 'lit/directives/repeat.js';
import { VirtualListController } from '../../lit/VirtualListController';

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
  // Controllers become `@inject` fields (the getter re-resolves from the
  // current container on each access, so re-adoption is safe): `ConfigController`,
  // `CollectionStateController`, `TelemetryManager`, plus `UploaderPublicApi`
  // (flow actions) and `UploadCollectionController` (clear-all). `RouterController`
  // is inherited from `ActivityChildBlock`. The throttled collection-update tick
  // is now adoption-guarded by `@throttled` (it no-ops after release), so it
  // reads these `@inject` fields directly; only the visibility predicate — which
  // can also run during a teardown tick — still reads via `useOrNull`.
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;
  @inject(UploadCollectionController) private readonly _uploadCollection!: UploadCollectionController;

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

  // List virtualization: only ~viewport±overscan `<uc-file-item>` render at large
  // file counts. The shared controller measures the `.uc-files` scroll container
  // and turns `uploadList` into the visible slice + spacer heights; row metrics
  // are app-specific (list = 1 col, grid = `--uc-grid-col` cols + inter-row gap),
  // so this block supplies them. It degrades to rendering the full list whenever
  // the container isn't laid out (happy-dom, hidden panel, pre-measurement paint).
  private readonly _virtualList = new VirtualListController(this, {
    scrollContainer: () => this.querySelector<HTMLElement>('.uc-files'),
    itemSelector: 'uc-file-item',
    rowMetrics: (scrollEl, firstItem) => {
      if (this._config.get('filesViewMode') !== 'grid') {
        this._rowGap = 0;
        return { columns: 1, rowHeight: firstItem.offsetHeight };
      }
      const gridCol = Number.parseInt(getComputedStyle(this).getPropertyValue('--uc-grid-col'), 10);
      // Flex `gap` sits BETWEEN grid cells (not in offsetHeight), so one grid row
      // is a cell plus one inter-row gap; list rows fold the gap into their box.
      const rowGap = Number.parseFloat(getComputedStyle(scrollEl).rowGap) || 0;
      this._rowGap = rowGap;
      return {
        columns: Number.isFinite(gridCol) && gridCol >= 1 ? gridCol : 1,
        rowHeight: firstItem.offsetHeight + rowGap,
      };
    },
  });

  // The measured inter-row flex gap (grid mode; 0 in list mode). A spacer is
  // itself a flex line, so the browser inserts one extra `gap` between it and the
  // adjacent item row — subtract it from the spacer height so the visible window
  // isn't pushed down/up by one gap.
  private _rowGap = 0;

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
    const errors = this._collectionState.getTracked('collectionErrors');
    const firstError = errors.filter((err) => err.type !== 'SOME_FILES_HAS_ERRORS')[0];
    return firstError?.message ?? null;
  }

  private _handleAdd = (): void => {
    this._telemetry.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'add-more',
          node: this.tagName,
        },
      },
    });
    this._api.initFlow(true);
  };

  private _handleUpload = (): void => {
    this.emit(EventType.UPLOAD_CLICK);
    this._api.uploadAll();
    this._throttledHandleCollectionUpdate();
  };

  private _handleDone = (): void => {
    this.emit(EventType.DONE_CLICK, this._api.getOutputCollectionState());
    this._api.doneFlow();
  };

  private _handleCancel = (): void => {
    this._telemetry.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'clear-all',
          node: this.tagName,
        },
      },
    });

    this._uploadCollection.clearAll();
  };

  // `@throttled` makes this adopted-guarded (a trailing tick after release —
  // e.g. a registry-unregistration race — no-ops) and cancels the pending timer
  // on release, so the body reads its throwing `@inject` fields directly instead
  // of the old `useOrNull` bail. Callers keep using `this._throttledHandleCollectionUpdate`
  // (a stable bound reference, still safe to hand to `observeCollection`).
  @throttled(300)
  protected _throttledHandleCollectionUpdate(): void {
    this._updateUploadsState();

    // The router guard (registered via `_guardNonEmpty`) decides whether the
    // empty list may stay open; ask it to re-check now that the collection changed.
    this.container.get(RouterController).revalidate();

    if (!this._config.get('confirmUpload')) {
      this._api.uploadAll();
    }
  }

  // Cheap toolbar summary: ONE pass over the raw collection entries computing
  // status counts, instead of `getOutputCollectionState()` which builds a full
  // `OutputFileEntry` object per entry (O(N) allocation) just for these numbers.
  // Status precedence is single-sourced with `getOutputItem` via
  // `deriveEntryStatus`. `anyValidationPending` mirrors the old
  // `allEntries.some(isValidationPending)` (ANY entry), while
  // `validatingBeforeUploading` counts only IDLE entries pending validation.
  private _computeSummary(): Summary & { anyValidationPending: boolean } {
    const collection = this._uploadCollection;
    let succeed = 0;
    let uploading = 0;
    let failed = 0;
    let validatingBeforeUploading = 0;
    let anyValidationPending = false;

    for (const id of collection.items()) {
      const entry = collection.read(id);
      if (!entry) {
        continue;
      }
      const fields = entry.values;
      if (fields.isValidationPending) {
        anyValidationPending = true;
      }
      switch (deriveEntryStatus(fields)) {
        case 'failed':
          failed++;
          break;
        case 'success':
          succeed++;
          break;
        case 'uploading':
          uploading++;
          break;
        case 'idle':
          if (fields.isValidationPending) {
            validatingBeforeUploading++;
          }
          break;
        // 'removed' entries are not counted.
      }
    }

    return { total: collection.size, succeed, uploading, failed, validatingBeforeUploading, anyValidationPending };
  }

  private _updateUploadsState(): void {
    // Imperative derived-state recompute (writes the toolbar/button `@state`
    // below), not a render read — runs only from the throttled tick after its
    // container guard, so the container is adopted and `@inject` reads resolve.
    // Config reads use the untracked `get()` (a re-render is driven by the
    // throttled tick's config-`observe`/collection observers, not by tracking here).
    const config = this._config;
    const { anyValidationPending, ...summary } = this._computeSummary();
    const errors = this._collectionState.get('collectionErrors');

    // One pass over the (tiny) collection-error list instead of two `.some()` scans.
    let tooMany = false;
    let fitCountRestrictions = true;
    for (const err of errors) {
      if (err.type === 'TOO_MANY_FILES') {
        tooMany = true;
        fitCountRestrictions = false;
      } else if (err.type === 'TOO_FEW_FILES') {
        fitCountRestrictions = false;
      }
    }

    const multiple = config.get('multiple');
    const exact = summary.total === (multiple ? config.get('multipleMax') : 1);
    const validationOk = summary.failed === 0 && errors.length === 0 && !anyValidationPending;
    let uploadBtnVisible = false;
    let allDone = false;
    let doneBtnEnabled = false;

    const readyToUpload = summary.total - summary.succeed - summary.uploading - summary.failed;
    if (readyToUpload > 0 && fitCountRestrictions && validationOk && config.get('confirmUpload')) {
      uploadBtnVisible = true;
    } else {
      allDone = true;
      const groupOk = config.get('groupOutput') ? !!this._collectionState.get('groupInfo') : true;
      doneBtnEnabled = summary.total === summary.succeed && fitCountRestrictions && validationOk && groupOk;
    }

    this._doneBtnVisible = allDone;
    this._doneBtnEnabled = doneBtnEnabled;
    this._uploadBtnVisible = uploadBtnVisible;
    this._addMoreBtnEnabled = summary.total === 0 || (!tooMany && !exact);
    this._addMoreBtnVisible = !exact || multiple;
    this._hasFiles = summary.total > 0;

    // Only replace the summary object when a count actually changed — a fresh
    // object every tick would dirty `@state` and force a re-render even when the
    // toolbar text is identical (the other fields above are primitives Lit dedups).
    const prev = this._latestSummary;
    if (
      !prev ||
      prev.total !== summary.total ||
      prev.succeed !== summary.succeed ||
      prev.uploading !== summary.uploading ||
      prev.failed !== summary.failed ||
      prev.validatingBeforeUploading !== summary.validatingBeforeUploading
    ) {
      this._latestSummary = summary;
    }
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

  // Guard: the upload list may only be open while it has files (or
  // `showEmptyList`). The router blocks navigating into it otherwise and
  // `revalidate()` (called on collection changes) leaves it once it empties.
  // The predicate reads null-tolerantly (`useOrNull`) — it can fire during a
  // teardown-time navigation, after the container is released, where `use()`
  // would throw.
  @subscription()
  protected _guardNonEmpty(): Unsubscribe {
    return this._router.guard(
      this.activityType,
      () =>
        (this.useOrNull(ConfigController)?.get('showEmptyList') ?? false) ||
        (this.useOrNull(UploadCollectionController)?.size ?? 0) > 0,
    );
  }

  // Group-size config re-runs the derived toolbar/button recompute — which
  // writes `@state` outside `render()`, so it's a subscription, not a tracked
  // render read. Per-key `observe` avoids re-firing on unrelated config changes;
  // the eager `rerun()` reproduces the former `subConfigValue` init fire.
  @subscription()
  protected _wireGroupSizeConfig(): Unsubscribe[] {
    const rerun = () => this._throttledHandleCollectionUpdate();
    return [
      this._config.observe('multiple', rerun, { immediate: true }),
      this._config.observe('multipleMin', rerun),
      this._config.observe('multipleMax', rerun),
    ];
  }

  // `groupInfo` (owned by `CollectionStateController`): fire the recompute only
  // when `groupInfo` itself changes (its atomic `observe` dedups, so an
  // unrelated collection-state write never re-triggers it), plus an eager pass.
  @subscription()
  protected _wireGroupInfo(): Unsubscribe {
    return this._collectionState.observe(
      'groupInfo',
      (groupInfo) => {
        if (groupInfo) {
          this._throttledHandleCollectionUpdate();
        }
      },
      { immediate: true },
    );
  }

  // Recompute button/summary state on collection changes. The uploader-scope
  // `UploadCollectionController` resolves only once the scope attaches, so go
  // through `whenController` (now-or-when-available); its callback returns the
  // observers directly and `whenController`'s unsubscribe disposes them.
  //
  // The summary + buttons derive from counts/status/validation — NOT per-entry
  // `uploadProgress` (that drives the progress bar, not this) — so we declare
  // only the status-affecting keys. This resolves the former "perf issue on many
  // files": progress ticks no longer wake this recompute.
  @subscription()
  protected _wireCollectionObservers(): Unsubscribe {
    return this.container.whenController(UploadCollectionController, (collection) => [
      collection.observeProperties(
        ['fileInfo', 'errors', 'uploadError', 'isUploading', 'isValidationPending'],
        this._throttledHandleCollectionUpdate,
      ),
      collection.observeCollection(this._throttledHandleCollectionUpdate),
    ]);
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
    this.setAttribute('mode', this._config.getTracked('filesViewMode'));
  }

  // A list⇆grid view-mode switch changes row height + column count but need not
  // resize the scroll container (so the ResizeObserver may not fire), so drop the
  // virtualizer's latched row metrics on the change to force a re-measure.
  // `observe` dedups per key and fires only on an actual change — no prev-value
  // bookkeeping.
  @subscription()
  protected _invalidateVirtualListOnViewMode(): Unsubscribe {
    return this._config.observe('filesViewMode', () => this._virtualList.invalidate());
  }

  public override render() {
    // Tracked render reads: `uploadList` drives the `<uc-file-item>` list and
    // `collectionErrors` (via `_commonErrorMessage`) drives the common-error row —
    // both `getTracked` off `CollectionStateController`, auto-tracked under
    // `SignalWatcher`, so a collection change re-renders with no `ctx.sub`.
    const uploadList = this._collectionState.getTracked('uploadList');
    const commonErrorMessage = this._commonErrorMessage;

    // Render only the visible window (+ overscan) with top/bottom spacers holding
    // the scroll height. Unmeasured geometry → full list, no spacers (unchanged).
    const view = this._virtualList.window(uploadList);
    const windowItems = view.items;
    // A spacer occupies its own flex line, so the flex `gap` adds one extra gap
    // between it and the adjacent row — shrink the spacer by that gap so the
    // rendered window lands where the scroll position expects (grid mode; `_rowGap`
    // is 0 in list mode, where the gap is folded into each row's own box).
    const topSpacer = view.topPad > 0 ? Math.max(0, view.topPad - this._rowGap) : 0;
    const bottomSpacer = view.bottomPad > 0 ? Math.max(0, view.bottomPad - this._rowGap) : 0;
    return html`
  <uc-activity-header>
    <span aria-live="polite" class="uc-header-text">${this._headerText}</span>
    <button
      type="button"
      class="uc-mini-btn uc-close-btn"
      @click=${() => this._router.traverse('onClose')}
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
    ${topSpacer > 0 ? html`<div class="uc-list-spacer" style="height:${topSpacer}px"></div>` : ''}
    ${repeat(
      windowItems,
      (uid) => uid,
      (uid) => html`<uc-file-item .uid=${uid}></uc-file-item>`,
    )}
    ${bottomSpacer > 0 ? html`<div class="uc-list-spacer" style="height:${bottomSpacer}px"></div>` : ''}
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
