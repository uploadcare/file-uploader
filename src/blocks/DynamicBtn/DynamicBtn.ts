import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { COLLECTION_SUMMARY_THROTTLE_MS } from '../../abstract/collectionSummary';
import { CollectionStateController } from '../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import { inject } from '../../abstract/di/inject';
import { observeSources } from '../../abstract/sources';
import type { Uid } from '../../abstract/Uid';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { booleanAttribute } from '../../lit/boolean-attribute';
import { ChildBlock } from '../../lit/ChildBlock';
import { throttled } from '../../lit/rate-limited-method';
import { subscription, type Unsubscribe } from '../../lit/subscription';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

import '../DropArea/DropArea';
import '../SourceBtn/SourceBtn';
import './dynamic-btn.css';
import './dynamic-btn-mode.css';

import type { OutputCollectionState, OutputCollectionStatus } from '../../types/exported';
import '../Thumb/Thumb';
import { classMap } from 'lit/directives/class-map.js';

import './PrimaryAction';
import '../DropDown/DropDown';
import '../FileItem/FileActionButton';
import './NoWrapModeDynamicBtn';
import { ACTIVITY_TYPES } from '../../abstract/activity-constants';

import type { DynamicButtonMode } from '../../abstract/config/validatorsType';

export type { DynamicButtonMode };

type SourceSplit = {
  main: SourceButtonConfig | null;
  remain: SourceButtonConfig[];
};

const adjustSourceBasedOnMode = (sources: SourceButtonConfig[], mode: DynamicButtonMode): SourceSplit => {
  if (mode === 'compact' || mode === 'plain') {
    return {
      main: null,
      remain: sources,
    };
  }

  return {
    main: sources[0] ?? null,
    remain: sources.slice(1),
  };
};

const AUTO_MODE_INLINE_THRESHOLD = 3;

export class DynamicBtn extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-dynamic-btn'];

  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(RouterController) private readonly _router!: RouterController;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;
  // Read only while adopted: `_api` from the adopted-guarded `@throttled` tick,
  // `_uploadCollection` from the rendered buttons' click handlers. (Observer
  // wiring goes through `whenController`.)
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;
  @inject(UploadCollectionController) private readonly _uploadCollection!: UploadCollectionController;

  @property({ converter: booleanAttribute })
  public dropzone = true;

  // Tracked read: `dynamicButtonViewMode` auto-tracks under `SignalWatcher`, so a
  // config change re-renders.
  private get _mode(): DynamicButtonMode {
    return this._config.getTracked('dynamicButtonViewMode');
  }

  @state()
  private _sources: SourceButtonConfig[] = [];

  // Derived from `_sources` + the tracked `_mode` (both re-render triggers), so a
  // change in either re-splits.
  private get _mainAndRemainSources(): SourceSplit {
    return adjustSourceBasedOnMode(this._sources, this._mode);
  }

  @state()
  private _collection!: OutputCollectionState<OutputCollectionStatus, 'maybe-has-group'>;

  private get _status(): OutputCollectionStatus {
    return this._collection?.status ?? 'idle';
  }

  // Tracked read: `commonProgress` (owned by `CollectionStateController`) auto-
  // tracks under `SignalWatcher`.
  private get _progress(): number {
    return this._collectionState.getTracked('commonProgress');
  }

  private get _dropdownIconName(): string {
    return this._mode === 'compact' ? 'paperclip' : 'arrow-dropdown';
  }

  private get isIdle() {
    return this._status === 'idle';
  }

  private get isSuccess() {
    return this._status === 'success';
  }

  private get isFailed() {
    return this._status === 'failed';
  }

  private get isUploading() {
    return this._status === 'uploading';
  }

  private get isCollapsedMode() {
    return this._mode === 'compact';
  }

  private get isPlainMode() {
    return this._mode === 'plain';
  }

  private get shouldShowPrimaryAction(): boolean {
    return !this.isCollapsedMode || !this.isIdle || this.hasCollectionEntries;
  }

  private get shouldShowInline(): boolean {
    return (
      this.isIdle &&
      !this.hasCollectionEntries &&
      this._sources.length > 1 &&
      (this._mode === 'toolbar' || (this._mode === 'auto' && this._sources.length <= AUTO_MODE_INLINE_THRESHOLD))
    );
  }

  private get shouldShowDropdown(): boolean {
    return (
      this.isIdle &&
      !this.shouldShowInline &&
      !this.shouldShowCompactSingleSource &&
      !this.hasCollectionEntries &&
      (this._sources.length > 1 || this.isCollapsedMode)
    );
  }

  private get shouldShowCompactSingleSource(): boolean {
    return this.isIdle && this.isCollapsedMode && !this.hasCollectionEntries && this._sources.length === 1;
  }

  private get hasCollectionEntries(): boolean {
    return (this._collection?.allEntries?.length ?? 0) > 0;
  }

  // `@throttled` makes this adopted-guarded (a trailing tick after release
  // no-ops) and cancels the pending timer on release. The `@subscription`
  // observers hand this stable bound reference to `observeCollection`.
  /** @internal */
  @throttled(COLLECTION_SUMMARY_THROTTLE_MS)
  protected _throttledHandleCollectionUpdate(): void {
    this._collection = this._api.getOutputCollectionState();
  }

  /** @internal */
  @subscription()
  protected _wireSources(): Unsubscribe {
    return observeSources(this.container, (sources) => {
      this._sources = sources;
    });
  }

  // The uploader-scope `UploadCollectionController` resolves only once the scope
  // attaches (which can race adoption), so go through `whenController`
  // (now-or-when-available); its callback returns the two observers, which
  // `whenController`'s unsubscribe disposes (so a re-adoption can't stack them).
  /** @internal */
  @subscription()
  protected _wireCollectionObservers(): Unsubscribe {
    return this.container.whenController(UploadCollectionController, (collection) => [
      // The button derives from the collection STATUS (idle/uploading/success/
      // failed) — declare only the status-affecting keys, so per-entry progress
      // ticks don't wake this recompute at large file counts.
      collection.observeProperties(
        ['fileInfo', 'errors', 'uploadError', 'isUploading'],
        this._throttledHandleCollectionUpdate,
      ),
      collection.observeCollection(this._throttledHandleCollectionUpdate),
    ]);
  }

  /** @internal */
  @subscription()
  protected _wireFileAddHook(): Unsubscribe {
    const router = this._router;
    return router.hooks.onFileAdd(() => {
      // With confirmUpload, always land on the upload list.
      if (this._config.get('confirmUpload')) {
        return ACTIVITY_TYPES.UPLOAD_LIST;
      }
      // If the user navigated somewhere to add the file, fall through to the
      // default (upload list); otherwise close everything so the dynamic button
      // just shows inline status.
      if (router.canGoBack) {
        return undefined;
      }
      return null;
    });
  }

  private _renderInline() {
    return html`
      <uc-no-wrap-mode-dynamic-btn>
        ${this._mainAndRemainSources.remain.map(
          (source) => html`<uc-source-btn .iconOnly=${true} .source=${source}></uc-source-btn>`,
        )}
      </uc-no-wrap-mode-dynamic-btn>
    `;
  }

  private _clearAllEntries() {
    this._uploadCollection.clearAll();
  }

  private _clearAllFailedEntries() {
    for (const it of this._collection.failedEntries) this._uploadCollection.remove(it.internalId as Uid);
  }
  private _abortAllEntries() {
    this._uploadCollection.abortAll();
  }

  private _handleRemove() {
    switch (this._status) {
      case 'failed':
        this._clearAllFailedEntries();
        break;
      case 'uploading':
        this._abortAllEntries();
        break;
      default:
        this._clearAllEntries();
    }
  }

  private _renderDropdown() {
    return html` <uc-drop-down>
      <uc-icon content-for="dd-header-button" name=${this._dropdownIconName}></uc-icon>
      <div content-for="dd-content" role="menu" class="uc-dropdown-menu">
        ${this._mainAndRemainSources.remain.map(
          (source) => html`<uc-source-btn .buttonRole=${'menuitem'} .source=${source}></uc-source-btn>`,
        )}
      </div>
    </uc-drop-down>`;
  }

  private _renderCompactSingleSource() {
    const source = this._sources[0];
    const compactSource = source ? { ...source, icon: 'paperclip' } : source;

    return html`
      <uc-no-wrap-mode-dynamic-btn>
        <uc-source-btn .iconOnly=${true} .source=${compactSource}></uc-source-btn>
      </uc-no-wrap-mode-dynamic-btn>
    `;
  }

  private _renderPrimaryAction() {
    return html`<uc-primary-action
      .entries=${this._collection}
      .source=${this._mainAndRemainSources.main}
    ></uc-primary-action>`;
  }

  private _renderAbortAction() {
    return html`<uc-file-action-button
      @uc:remove=${this._handleRemove}
      .uploading=${this.isUploading}
      .failed=${this.isFailed}
      .success=${this.isSuccess}
      .progress=${this._progress}
    ></uc-file-action-button>`;
  }

  private _getInnerClassMap() {
    return classMap({
      'uc-dynamic-btn-inner': true,
      'uc-failed': this.isFailed,
      'uc-uploading': this.isUploading,
      'uc-success': this.isSuccess,
    });
  }

  private _renderVisualDropArea() {
    return html`
      <div class="uc-visual-drop-area">
        <uc-icon name="arrow-down"></uc-icon>
      </div>
    `;
  }

  public override render() {
    return html`
      <uc-drop-area .disabled=${!this.dropzone}>
        <div class=${this._getInnerClassMap()}>
          ${this.shouldShowPrimaryAction ? this._renderPrimaryAction() : null}
          ${this.shouldShowInline ? this._renderInline() : null}
          ${this.shouldShowCompactSingleSource ? this._renderCompactSingleSource() : null}
          ${!this.isPlainMode && this.shouldShowDropdown ? this._renderDropdown() : null}
          ${this.hasCollectionEntries ? this._renderAbortAction() : null}
          ${this._renderVisualDropArea()}
        </div>
      </uc-drop-area>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-dynamic-btn': DynamicBtn;
  }
}
