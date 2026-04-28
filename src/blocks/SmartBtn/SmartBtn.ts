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

export type SmartButtonMode = 'auto' | 'allwrap' | 'nowrap' | 'collapse';

export class NoWrapModeSmartBtn extends LitUploaderBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-no-wrap-mode-smart-btn'];
}

export class PrimaryAction extends LitUploaderBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-primary-action'];

  @property({ attribute: 'custom-label' })
  public customLabel!: string;

  @property()
  public source!: SourceButtonConfig;

  @property()
  public entries!: OutputCollectionState<OutputCollectionStatus, 'maybe-has-group'>;

  @state()
  private showIcon = this.cfg.smartBtnShowFirstIcon;

  public override initCallback(): void {
    super.initCallback();

    this.subConfigValue('smartBtnShowFirstIcon', (value) => {
      this.showIcon = value;
    });
  }

  private _headerTextDependentOnEntries() {
    const wr = (key, count) => {
      return this.l10n(key, {
        count,
      });
    };

    if (this.entries?.status === 'uploading') {
      return wr('header-uploading', this.entries.uploadingCount);
    }
    if (this.entries?.status === 'failed') {
      return wr('header-failed', this.entries.failedCount);
    }
    if (this.entries?.status === 'success') {
      return wr('header-succeed', this.entries.successCount);
    }
  }

  private get textBasedOnLocale() {
    const wr = (key, label) => {
      return this.l10n(key, {
        source: this.l10n(label).toLocaleLowerCase(),
      });
    };

    if (this.customLabel) {
      return this.customLabel;
    }

    const result = this._headerTextDependentOnEntries();

    if (result) {
      return result;
    }

    if (!this.source?.label || !this.source?.id) {
      return '';
    }

    switch (this.source?.id) {
      case 'local':
        return wr('upload-from', this.source.label);
      case 'camera':
        return wr('take', this.source.label);
      case 'mobile-photo-camera':
        return wr('take', 'photo');
      case 'mobile-video-camera':
        return wr('record', 'video');
      case 'url':
        return wr('upload-from', this.source.label);
      default:
        return wr('get-from', this.source.label);
    }
  }

  private _handleClick() {
    if (this.entries?.allEntries?.length > 0) {
      this._sharedInstancesBag.ctx.pub('*currentActivity', 'upload-list');
      this._sharedInstancesBag.modalManager?.open('upload-list');

      return;
    }

    void this.source?.onClick();
  }

  private _renderThumbnail() {
    if (this.entries?.allEntries?.length === 1 && this.entries.isSuccess) {
      const entry = this.entries.allEntries[0];
      const isImage = entry?.isImage;

      if (isImage) {
        return html`<uc-thumb .uid=${entry?.internalId}></uc-thumb>`;
      }
      return null;
    } else if (this.entries?.allEntries?.length > 1) {
      return null;
    } else {
      return this.showIcon ? html`<uc-icon .name=${this.source?.icon}></uc-icon>` : null;
    }
  }

  protected override render() {
    return html`
        <button class="uc-primary-action" @click=${this._handleClick}>
          ${this._renderThumbnail()}
          <span>${this.textBasedOnLocale}</span>
        </button>
    `;
  }
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
        <uc-icon content-for="dd-header-button" name=${iconsBasedOnMode[this._mode]}></uc-icon>
        <div content-for="dd-content" role="menu" class="uc-dropdown-menu">
          ${this._mainAndRemainSources?.remain?.map((source) => html`<uc-source-btn role="menuitem" .source=${source}></uc-source-btn>`)}
        </div>
      </uc-drop-down>`;
  }

  private _renderPrimaryAction() {
    return html`<uc-primary-action .entries=${this._collection} .source=${this._mainAndRemainSources?.main}></uc-primary-action>`;
  }

  private _handleRemove() {
    this.uploadCollection.clearAll();
  }

  private _renderAbortAction() {
    return html`<uc-file-action-button @uc:remove=${this._handleRemove} .uploading=${this._status === 'uploading'} .failed=${this._status === 'failed'} .progress=${this._progress}></uc-file-action-button>`;
  }

  public override render() {
    return html`
      <uc-drop-area .disabled=${!this.dropzone}>
        <div class="uc-smart-btn-inner">
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
