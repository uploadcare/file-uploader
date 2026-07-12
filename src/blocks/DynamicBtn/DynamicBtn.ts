import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { cache } from 'lit/directives/cache.js';
import { SourceListController } from '../../abstract/controllers';
import { ChildBlock } from '../../lit/ChildBlock';
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

  @property({ attribute: 'dropzone', type: Boolean })
  public dropzone = true;

  @state()
  private _mode: DynamicButtonMode = 'auto';

  @state()
  private _sources: SourceButtonConfig[] = [];

  @state()
  private _status: 'idle' | 'success' | 'uploading' | 'failed' = 'idle';

  @state()
  private _mainAndRemainSources!: SourceSplit;

  @state()
  private _collection!: OutputCollectionState<OutputCollectionStatus, 'maybe-has-group'>;

  @state()
  private _progress = 0;

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
    const collectionState = this.bag.api?.getOutputCollectionState();

    if (!collectionState) {
      console.warn('Collection state is undefined');
      return;
    }

    this._collection = collectionState;
    this._status = collectionState.status;
  }

  private _updateSourceSplit(): void {
    this._mainAndRemainSources = adjustSourceBasedOnMode(this._sources, this._mode);
  }

  protected override controllerReady(): void {
    this.subConfigValue('dynamicButtonViewMode', (value) => {
      if (this._mode === value) return;

      this._mode = value;
      this._updateSourceSplit();
    });

    this.trackSub(
      this.bag.ctx.sub('*commonProgress', (progress: number) => {
        this._progress = progress;
      }),
    );

    new SourceListController(this, {
      ctx: this.bag.ctx,
      sharedInstancesBag: this.bag,
      onSourcesChange: (sources) => {
        this._sources = sources;
        this._updateSourceSplit();
      },
    });

    // The uploader-scope `*uploadCollection` instance may not have registered
    // yet when this block's controller adopts (it's published once the
    // uploader/solution block finishes its own init, which can race this
    // block's adoption) — go through `bag.when` rather than the throwing
    // `bag.uploadCollection` getter (FileItem precedent for `pluginManager`).
    this.trackSub(
      this.bag.when('uploadCollection', (collection) => {
        collection.observeProperties(this._throttledHandleCollectionUpdate);
        collection.observeCollection(this._throttledHandleCollectionUpdate);
      }),
    );

    this.trackSub(
      this.bag.router.hooks.onFileAdd(() => {
        // With confirmUpload, always land on the upload list.
        if (this.uploader.config.get('confirmUpload')) {
          return ACTIVITY_TYPES.UPLOAD_LIST;
        }
        // If the user navigated somewhere to add the file, fall through to the
        // default (upload list); otherwise close everything so the dynamic button
        // just shows inline status.
        if (this.bag.router.canGoBack) {
          return undefined;
        }
        return null;
      }),
    );
  }

  public override disconnectedCallback(): void {
    if (typeof this._throttledHandleCollectionUpdate.cancel === 'function') {
      this._throttledHandleCollectionUpdate.cancel();
    }
    super.disconnectedCallback();
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
    this.bag.uploadCollection.clearAll();
  }

  private _clearAllFailedEntries() {
    this._collection.failedEntries.forEach((it) => {
      if (it && this.bag.uploadCollection.hasItem(it.internalId as Uid)) {
        this.bag.uploadCollection.remove(it.internalId as Uid);
      }
    });
  }
  private _abortAllEntries() {
    this.bag.uploadCollection.abortAll();
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
