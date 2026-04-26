import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { SourceListController } from '../../abstract/controllers';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

import '../DropArea/DropArea';
import '../SourceBtn/SourceBtn';
import './smart-btn.css';
import type { OutputCollectionState, OutputCollectionStatus, OutputFileEntry } from '../../types/exported';
import { throttle } from '../../utils/throttle';
import { UID } from '../../utils/UID';

export type SmartButtonMode = 'auto' | 'allwrap' | 'nowrap' | 'collapse';

export class AllWrapModeSmartBtn extends LitUploaderBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-all-wrap-mode-smart-btn'];

  @property({ attribute: 'mode' })
  public mode = this.cfg.smartBtnViewMode;

  private _id = UID.generateFastUid();

  private readonly _handleContentClick = (e: Event) => {
    (e.currentTarget as HTMLElement).hidePopover();
  };

  protected override render() {
    return html`
      <button class="uc-mini-btn uc-dropdown-btn" popovertarget=${this._id} popovertargetaction="toggle">
        ${this.yield('dd-header-button')}
      </button>

      <div id=${this._id} class="uc-dropdown-content" popover="auto" @click=${this._handleContentClick}>
        ${this.yield('dd-content')}
      </div>
    `;
  }
}

export class NoWrapModeSmartBtn extends LitUploaderBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-no-wrap-mode-smart-btn'];

  protected override render() {
    return html`

    `;
  }
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

  protected override update(changedProperties: PropertyValues): void {
    super.update(changedProperties);

    if (changedProperties.has('entries')) {
      const newShowIcon = this.entries.allEntries.length > 0 ? false : this.cfg.smartBtnShowFirstIcon;
      if (newShowIcon !== this.showIcon) {
        this.showIcon = newShowIcon;
        // this.requestUpdate();
      }
    }
  }

  private _headerTextDependentOnEntries() {
    if (this.entries?.status === 'uploading') {
      return this.l10n('header-uploading', { count: this.entries.uploadingCount });
    }
    if (this.entries?.status === 'failed') {
      return this.l10n('header-failed', { count: this.entries.failedCount });
    }
    if (this.entries?.status === 'success') {
      return this.l10n('header-succeed', { count: this.entries.successCount });
    }
  }

  private get textBasedOnLocale() {
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
        return this.l10n('upload-from', {
          source: this.l10n(this.source.label).toLocaleLowerCase(),
        });
      case 'camera':
        return this.l10n('take', {
          source: this.l10n(this.source.label).toLocaleLowerCase(),
        });
      case 'url':
        return this.l10n('upload-from', {
          source: this.l10n(this.source.label).toLocaleLowerCase(),
        });
      default:
        return this.l10n('get-from', {
          source: this.l10n(this.source.label),
        });
    }
  }

  private _handleClick() {
    if (this.entries.allEntries.length > 0) {
      this._sharedInstancesBag.ctx.pub('*currentActivity', 'upload-list');
      this._sharedInstancesBag.modalManager?.open('upload-list');

      return;
    }

    this.source?.onClick();
    setTimeout(() => {
      this._sharedInstancesBag.ctx.pub('*currentActivity', null);
      this._sharedInstancesBag.modalManager?.closeAll();
    }, 300);
  }

  protected override render() {
    return html`
        <button class="uc-primary-action" @click=${this._handleClick}>
            ${this.showIcon ? html`<uc-icon name=${this.source?.icon}></uc-icon>` : null}
            <!-- ${this.entries ? html`<uc-thumb .uid=${this.entries.internalId}></uc-thumb>` : null} -->
            <span>${this.textBasedOnLocale}</span>
        </button>
    `;
  }
}

export class AbortAction extends LitUploaderBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-abort-action'];

  private _handleClickAbort() {
    this.uploadCollection.clearAll();
  }

  public override render() {
    return html`
      <button class="uc-mini-btn uc-close-btn uc-abort-btn" type="button" @click=${this._handleClickAbort}>
        <uc-icon name="remove-file"></uc-icon>
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
  private _collection;

  @state()
  private _entries?: OutputFileEntry[];

  private _throttledHandleCollectionUpdate = throttle(() => {
    if (!this.isConnected) {
      return;
    }
    this._updateButtonBasedOnCollectionState();
  }, 300);

  private _updateButtonBasedOnCollectionState() {
    const collectionState = this.api.getOutputCollectionState();

    // if (collectionState.totalCount === 1 && collectionState.successEntries.length === 1) {
    //   const successfulEntry = collectionState.successEntries[0];

    //   this.entry = successfulEntry;
    // } else {
    //   this.entry = undefined;
    // }

    this._collection = collectionState;
    this._entries = collectionState.allEntries;
    this._status = collectionState.status;
  }

  public override initCallback(): void {
    super.initCallback();

    this.subConfigValue('smartBtnViewMode', (value) => {
      this._mode = value;

      this._mainAndRemainSources = adjustSourceBasedOnMode(this._sources, this._mode);
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
        <uc-all-wrap-mode-smart-btn mode=${this._mode}>
            <uc-icon content-for="dd-header-button" name=${iconsBasedOnMode[this._mode]}></uc-icon>
            <div content-for="dd-content" role="menu" class="uc-dropdown-menu">
                ${this._mainAndRemainSources?.remain?.map((source) => html`<uc-source-btn role="menuitem" .source=${source}></uc-source-btn>`)}
            </div>
        </uc-all-wrap-mode-smart-btn>`;
  }

  private _renderPrimaryAction() {
    return html`<uc-primary-action .entries=${this._collection} .source=${this._mainAndRemainSources?.main}></uc-primary-action>`;
  }

  private _renderAbortAction() {
    return html`<uc-abort-action></uc-abort-action>`;
  }

  public override render() {
    return html`
        <uc-drop-area .disabled=${!this.dropzone}>
            <div class="uc-smart-btn-inner">

                ${this._mode !== 'collapse' ? this._renderPrimaryAction() : null}

                ${this._status === 'idle' ? (this._mode === 'nowrap' || (this._mode === 'auto' && this._sources.length <= 3) ? this._renderInline() : this._renderDropdown()) : null}

                ${this._status !== 'idle' ? (this._entries?.length ? this._renderAbortAction() : null) : null}

                <div class="uc-visual-drop-area">
                    <uc-icon name="arrow-down"></uc-icon>
                </div>
            </div>
        </uc-drop-area>
    `;
  }
}
