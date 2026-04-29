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

export class NoWrapModeSmartBtn extends LitUploaderBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-no-wrap-mode-smart-btn'];
}

const adjustSourceBasedOnMode = (sources: SourceButtonConfig[], mode: SmartButtonMode) => {
  if (mode === 'collapse') {
    return {
      main: null,
      remain: sources,
    };
  }

  const [firstSource] = sources;

  return {
    main: firstSource,
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
  private _mainAndRemainSources!: {
    main?: SourceButtonConfig | null;
    remain: SourceButtonConfig[];
  };

  @state()
  private _collection!: OutputCollectionState<OutputCollectionStatus, 'maybe-has-group'>;

  @state()
  private _progress = 0;

  private get isIdle() {
    return this._status === 'idle';
  }

  private _throttledHandleCollectionUpdate = throttle(() => {
    if (!this.isConnected) {
      return;
    }
    this._updateButtonBasedOnCollectionState();
  }, 300);

  private _updateButtonBasedOnCollectionState() {
    const collectionState = this.api.getOutputCollectionState();

    this._collection = collectionState;
    this._status = collectionState.status;
  }

  public override initCallback(): void {
    super.initCallback();

    this.subConfigValue('smartBtnViewMode', (value) => {
      this._mode = value;

      this._mainAndRemainSources = adjustSourceBasedOnMode(this._sources, this._mode);
    });

    this.sub('*commonProgress', (progress: number) => {
      this._progress = progress;
    });

    this._controller = new SourceListController({
      ctx: this._sharedInstancesBag.ctx,
      sharedInstancesBag: this._sharedInstancesBag,
      onSourcesChange: (sources) => {
        this._mainAndRemainSources = adjustSourceBasedOnMode(sources, this._mode);
        this._sources = sources;
      },
    });
    this._controller.init();

    this.uploadCollection.observeProperties(this._throttledHandleCollectionUpdate);
    this.uploadCollection.observeCollection(this._throttledHandleCollectionUpdate);
  }

  public override disconnectedCallback(): void {
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

  private _renderDropdown() {
    return html`
      <uc-drop-down>
        <uc-icon content-for="dd-header-button" name=${iconsBasedOnMode[this._mode as Exclude<SmartButtonMode, 'nowrap'>]}></uc-icon>
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

  public override render() {
    return html`
      <uc-drop-area .disabled=${!this.dropzone} >
        <div
          class=${classMap({
            'uc-smart-btn-inner': true,
            'uc-failed': this._status === 'failed',
            'uc-uploading': this._status === 'uploading',
            'uc-success': this._status === 'success',
          })}
        >
          ${this._mode !== 'collapse' ? this._renderPrimaryAction() : !this.isIdle ? this._renderPrimaryAction() : null}

          ${this.isIdle ? (this._mode === 'nowrap' || (this._mode === 'auto' && this._sources.length <= 3) ? this._renderInline() : this._renderDropdown()) : null}

          ${!this.isIdle ? (this._collection?.allEntries?.length ? this._renderAbortAction() : null) : null}

          <div class="uc-visual-drop-area">
            <uc-icon name="arrow-down"></uc-icon>
          </div>
        </div>
      </uc-drop-area>
    `;
  }
}
