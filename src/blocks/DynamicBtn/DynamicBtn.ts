import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { cache } from 'lit/directives/cache.js';
import { SourceListController } from '../../abstract/controllers';
import { CollectionStateController } from '../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import type { ControllerContainer } from '../../abstract/di/ControllerContainer';
import { inject, injectOrNull } from '../../abstract/di/inject';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { ChildBlock } from '../../lit/ChildBlock';
import { subscription, type Unsubscribe } from '../../lit/subscription';
import type { Uid } from '../../lit/Uid';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

import '../DropArea/DropArea';
import '../SourceBtn/SourceBtn';
import './dynamic-btn.css';
import './dynamic-btn-mode.css';

import type { OutputCollectionState, OutputCollectionStatus } from '../../types/exported';
import { throttle } from '../../utils/throttle';
import '../Thumb/Thumb';
import { classMap } from 'lit/directives/class-map.js';

import './PrimaryAction';
import '../DropDown/DropDown';
import '../FileItem/FileActionButton';
import './NoWrapModeDynamicBtn';
import { ACTIVITY_TYPES } from '../../lit/activity-constants';

export type DynamicButtonMode = 'auto' | 'menu' | 'toolbar' | 'compact';

type SourceSplit = {
  main: SourceButtonConfig | null;
  remain: SourceButtonConfig[];
};

const adjustSourceBasedOnMode = (sources: SourceButtonConfig[], mode: DynamicButtonMode): SourceSplit => {
  if (mode === 'compact' || sources.length === 0) {
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

const iconsBasedOnMode: Record<Exclude<DynamicButtonMode, 'toolbar'>, string> = {
  compact: 'paperclip',
  menu: 'arrow-dropdown',
  auto: 'arrow-dropdown',
};

const AUTO_MODE_INLINE_THRESHOLD = 3;

export class DynamicBtn extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-dynamic-btn'];

  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(RouterController) private readonly _router!: RouterController;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;
  // `UploadCollectionController` and `UploaderPublicApi` are `@injectOrNull`
  // (not `@inject`): the former is uploader-scope-bound and can race this block's
  // adoption; the latter is read from a trailing throttle tick that can outlive
  // release. Both would throw as `@inject` in those windows, so they resolve
  // `null` and are read with `?.`. (Observer wiring goes through `whenController`.)
  @injectOrNull(UploaderPublicApi) private readonly _api!: UploaderPublicApi | null;
  @injectOrNull(UploadCollectionController) private readonly _uploadCollection!: UploadCollectionController | null;

  @property({ attribute: 'dropzone', type: Boolean })
  public dropzone = true;

  // Tracked read: `dynamicButtonViewMode` auto-tracks under `SignalWatcher`, so a
  // config change re-renders — replacing the v1 `subConfigValue` mirror that fed
  // a `_mode` @state and imperatively recomputed `_mainAndRemainSources`.
  private get _mode(): DynamicButtonMode {
    return this._config.getTracked('dynamicButtonViewMode');
  }

  private _sourceListController: SourceListController | null = null;

  @state()
  private _sources: SourceButtonConfig[] = [];

  @state()
  private _status: 'idle' | 'success' | 'uploading' | 'failed' = 'idle';

  // Derived from `_sources` + the tracked `_mode` (both re-render triggers), so a
  // change in either re-splits with no imperative `_updateSourceSplit`.
  private get _mainAndRemainSources(): SourceSplit {
    return adjustSourceBasedOnMode(this._sources, this._mode);
  }

  @state()
  private _collection!: OutputCollectionState<OutputCollectionStatus, 'maybe-has-group'>;

  // Tracked read: `commonProgress` (owned by `CollectionStateController`) auto-
  // tracks under `SignalWatcher` — replacing the v1 `ctx.sub('*commonProgress')`
  // subscription that mirrored it into `_progress` @state.
  private get _progress(): number {
    return this._collectionState.getTracked('commonProgress');
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

  private get shouldShowAbortAction(): boolean {
    return !this.isIdle && this.hasCollectionEntries;
  }

  private _throttledHandleCollectionUpdate = throttle(() => {
    if (!this.isConnected) {
      return;
    }
    this._updateButtonBasedOnCollectionState();
  }, 300);

  private _updateButtonBasedOnCollectionState() {
    // This runs from the throttled tick, which can fire after the block is
    // released while still connected — `_api` is `@injectOrNull`, so it reads
    // `null` then (the trailing-tick guard the v1 `bag.apiOrNull` read provided).
    const collectionState = this._api?.getOutputCollectionState();

    if (!collectionState) {
      this._log.warn('Collection state is undefined');
      return;
    }

    this._collection = collectionState;
    this._status = collectionState.status;
  }

  protected override controllerReady(container: ControllerContainer): void {
    // Re-adoption would otherwise stack a new SourceListController per
    // adoption without removing the previous one (same shape as SourceList).
    this._teardownSourceListController();
    this._sourceListController = new SourceListController(this, {
      config: this._config,
      container,
      onSourcesChange: (sources) => {
        this._sources = sources;
      },
    });
  }

  // The uploader-scope `UploadCollectionController` resolves only once the scope
  // attaches (which can race adoption), so go through `whenController`
  // (now-or-when-available); its callback returns the two observers, which
  // `whenController`'s unsubscribe disposes (so a re-adoption can't stack them).
  @subscription()
  protected _wireCollectionObservers(): Unsubscribe {
    return this.container.whenController(UploadCollectionController, (collection) => [
      collection.observeProperties(this._throttledHandleCollectionUpdate),
      collection.observeCollection(this._throttledHandleCollectionUpdate),
    ]);
  }

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
        ${this._mainAndRemainSources?.remain?.map(
          (source) => html`<uc-source-btn .iconOnly=${true} role="menuitem" .source=${source}></uc-source-btn>`,
        )}
      </uc-no-wrap-mode-dynamic-btn>
    `;
  }

  private _getDropdownIconName(): string {
    return iconsBasedOnMode[this._mode as Exclude<DynamicButtonMode, 'toolbar'>] ?? 'arrow-dropdown';
  }

  private _clearAllEntries() {
    this._uploadCollection?.clearAll();
  }

  private _clearAllFailedEntries() {
    const collection = this._uploadCollection;
    if (!collection) return;
    this._collection.failedEntries.forEach((it) => {
      if (it && collection.hasItem(it.internalId as Uid)) {
        collection.remove(it.internalId as Uid);
      }
    });
  }
  private _abortAllEntries() {
    this._uploadCollection?.abortAll();
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
      <uc-icon content-for="dd-header-button" name=${this._getDropdownIconName()}></uc-icon>
      <div content-for="dd-content" role="menu" class="uc-dropdown-menu">
        ${this._mainAndRemainSources?.remain?.map(
          (source) => html`<uc-source-btn role="menuitem" .source=${source}></uc-source-btn>`,
        )}
      </div>
    </uc-drop-down>`;
  }

  private _renderCompactSingleSource() {
    const source = this._sources[0];
    const compactSource = source ? { ...source, icon: iconsBasedOnMode.compact } : source;

    return html`
      <uc-no-wrap-mode-dynamic-btn>
        <uc-source-btn .iconOnly=${true} .source=${compactSource}></uc-source-btn>
      </uc-no-wrap-mode-dynamic-btn>
    `;
  }

  private _renderPrimaryAction() {
    return html`<uc-primary-action
      .entries=${this._collection}
      .source=${this._mainAndRemainSources?.main}
    ></uc-primary-action>`;
  }

  private _renderAbortAction() {
    return html`<uc-file-action-button
      @uc:remove=${this._handleRemove}
      .uploading=${this.isUploading}
      .failed=${this.isFailed}
      .success=${this.isSuccess}
      .idle=${this.isIdle}
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

  protected override controllerReleased(): void {
    this._teardownSourceListController();
    // The throttled collection-update tick is fed by the `@subscription`
    // collection observers (auto-disposed on release); cancel any trailing tick
    // here so it can't fire against a released container. Runs on disconnect too,
    // via the base `disconnectedCallback` → `_releaseController`.
    if (typeof this._throttledHandleCollectionUpdate.cancel === 'function') {
      this._throttledHandleCollectionUpdate.cancel();
    }
  }

  private _teardownSourceListController(): void {
    if (!this._sourceListController) {
      return;
    }
    this._sourceListController.hostDisconnected();
    this.removeController(this._sourceListController);
    this._sourceListController = null;
  }

  public override render() {
    return html`
      <uc-drop-area .disabled=${!this.dropzone}>
        <div class=${this._getInnerClassMap()}>
          ${cache(this.shouldShowPrimaryAction ? this._renderPrimaryAction() : null)}
          ${cache(this.shouldShowInline ? this._renderInline() : null)}
          ${cache(this.shouldShowCompactSingleSource ? this._renderCompactSingleSource() : null)}
          ${cache(this.shouldShowDropdown ? this._renderDropdown() : null)}
          ${cache(this.shouldShowAbortAction || this.hasCollectionEntries ? this._renderAbortAction() : null)}
          ${cache(this._renderVisualDropArea())}
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
