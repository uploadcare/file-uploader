import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { SourceListController } from '../../abstract/controllers';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

import '../DropArea/DropArea';
import '../SourceBtn/SourceBtn';
import './smart-btn.css';
import './smart-btn-mode.css';

import type { OutputCollectionState, OutputCollectionStatus } from '../../types/exported';
import { throttle } from '../../utils/throttle';
import '../Thumb/Thumb';
import { classMap } from 'lit/directives/class-map.js';

import './PrimaryAction';
import '../DropDown/DropDown';
import '../FileItem/FileActionButton';

export type SmartButtonMode = 'auto' | 'allwrap' | 'nowrap' | 'collapse';

type SourceSplit = {
  main: SourceButtonConfig | null;
  remain: SourceButtonConfig[];
};

export class NoWrapModeSmartBtn extends LitUploaderBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-no-wrap-mode-smart-btn'];
}

const adjustSourceBasedOnMode = (sources: SourceButtonConfig[], mode: SmartButtonMode): SourceSplit => {
  if (mode === 'collapse' || sources.length === 0) {
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

const iconsBasedOnMode: Record<Exclude<SmartButtonMode, 'nowrap'>, string> = {
  collapse: 'paperclip',
  allwrap: 'arrow-dropdown',
  auto: 'arrow-dropdown',
};

export class SmartBtn extends LitUploaderBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-smart-btn', 'uc-wgt-common'];
  public override couldBeCtxOwner = true;

  private static readonly AUTO_MODE_INLINE_THRESHOLD = 3;

  private _controller?: SourceListController;

  @property({ attribute: 'dropzone', type: Boolean })
  public dropzone = true;

  @state()
  private _mode: SmartButtonMode = 'auto';

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

  private get shouldShowPrimaryAction(): boolean {
    return this._mode !== 'collapse' || !this.isIdle;
  }

  private get shouldShowInline(): boolean {
    return (
      this.isIdle &&
      (this._mode === 'nowrap' ||
        (this._mode === 'auto' && this._sources.length <= SmartBtn.AUTO_MODE_INLINE_THRESHOLD))
    );
  }

  private get shouldShowDropdown(): boolean {
    return this.isIdle && !this.shouldShowInline;
  }

  private get shouldShowAbortAction(): boolean {
    return !this.isIdle && (this._collection?.allEntries?.length ?? 0) > 0;
  }

  private _throttledHandleCollectionUpdate = throttle(() => {
    if (!this.isConnected) {
      return;
    }
    this._updateButtonBasedOnCollectionState();
  }, 300);

  private _updateButtonBasedOnCollectionState() {
    const collectionState = this.api?.getOutputCollectionState();

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

  public override initCallback(): void {
    super.initCallback();

    this.subConfigValue('smartBtnViewMode', (value) => {
      if (this._mode === value) return;

      this._mode = value;
      this._updateSourceSplit();
    });

    this.sub('*commonProgress', (progress: number) => {
      this._progress = progress;
    });

    this._controller = new SourceListController({
      ctx: this._sharedInstancesBag.ctx,
      sharedInstancesBag: this._sharedInstancesBag,
      onSourcesChange: (sources) => {
        this._sources = sources;
        this._updateSourceSplit();
      },
    });
    this._controller.init();

    this.uploadCollection.observeProperties(this._throttledHandleCollectionUpdate);
    this.uploadCollection.observeCollection(this._throttledHandleCollectionUpdate);
  }

  public override disconnectedCallback(): void {
    if (typeof this._throttledHandleCollectionUpdate.cancel === 'function') {
      this._throttledHandleCollectionUpdate.cancel();
    }
    this._controller?.destroy();
    super.disconnectedCallback();
  }

  private _renderInline() {
    return html`
      <uc-no-wrap-mode-smart-btn>
        ${this._mainAndRemainSources?.remain?.map((source) => html`<uc-source-btn .iconOnly=${true} role="menuitem" .source=${source}></uc-source-btn>`)}
      </uc-no-wrap-mode-smart-btn>
    `;
  }

  private _getDropdownIconName(): string {
    return iconsBasedOnMode[this._mode] ?? 'arrow-dropdown';
  }

  private _renderDropdown() {
    return html`
      <uc-drop-down>
        <uc-icon content-for="dd-header-button" name=${this._getDropdownIconName()}></uc-icon>
        <div content-for="dd-content" role="menu" class="uc-dropdown-menu">
          ${this._mainAndRemainSources?.remain?.map((source) => html`<uc-source-btn role="menuitem" .source=${source}></uc-source-btn>`)}
        </div>
      </uc-drop-down>`;
  }

  private _renderPrimaryAction() {
    return html`<uc-primary-action .entries=${this._collection} .source=${this._mainAndRemainSources?.main}></uc-primary-action>`;
  }

  private _handleRemove() {
    if (this._status === 'uploading') {
      this.uploadCollection.abortAll();
      return;
    }

    this.uploadCollection.clearAll();
  }

  private _renderAbortAction() {
    return html`<uc-file-action-button @uc:remove=${this._handleRemove} .uploading=${this._status === 'uploading'} .failed=${this._status === 'failed'} .progress=${this._progress}></uc-file-action-button>`;
  }

  private _getInnerClassMap() {
    return classMap({
      'uc-smart-btn-inner': true,
      'uc-failed': this._status === 'failed',
      'uc-uploading': this._status === 'uploading',
      'uc-success': this._status === 'success',
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
          ${this.shouldShowDropdown ? this._renderDropdown() : null}
          ${this.shouldShowAbortAction ? this._renderAbortAction() : null}
          ${this._renderVisualDropArea()}
        </div>
      </uc-drop-area>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-smart-btn': SmartBtn;
    'uc-no-wrap-mode-smart-btn': SmartBtn;
  }
}
