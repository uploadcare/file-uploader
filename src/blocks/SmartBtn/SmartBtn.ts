import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { SourceListController } from '../../abstract/controllers';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

import '../DropArea/DropArea';
import '../SourceBtn/SourceBtn';
import './smart-btn.css';
import { UID } from '../../utils/UID';

export type SmartButtonMode = 'auto' | 'allwrap' | 'nowrap' | 'collapse';

export class AllWrapModeSmartBtn extends LitUploaderBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-all-wrap-mode-smart-btn'];

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

const adjustSourceBasedOnMode = (source: SourceButtonConfig[], mode: SmartButtonMode) => {};

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
  private _showFirstIcon = false;

  public override initCallback(): void {
    super.initCallback();

    this.subConfigValue('smartBtnShowFirstIcon', (value) => {
      this._showFirstIcon = !value;
    });

    this.subConfigValue('smartBtnViewMode', (value) => {
      this._mode = value;
    });

    this._controller = new SourceListController({
      ctx: this._sharedInstancesBag.ctx,
      sharedInstancesBag: this._sharedInstancesBag,
      onSourcesChange: (sources) => {
        this._sources = sources;
      },
    });
    this._controller.init();
  }

  public override disconnectedCallback(): void {
    this._controller?.destroy();
    super.disconnectedCallback();
  }

  public override render() {
    return html`
        <uc-all-wrap-mode-smart-btn>
            <uc-icon content-for="dd-header-button" name="paperclip"></uc-icon>
            <div content-for="dd-content" role="menu" class="uc-dropdown-menu">
                ${this._sources.map((source) => html`<uc-source-btn role="menuitem" .source=${source}></uc-source-btn>`)}
            </div>
        </uc-all-wrap-mode-smart-btn>

        <uc-no-wrap-mode-smart-btn>
            ${this._sources.map((source) => html`<uc-source-btn .iconOnly=${true} role="menuitem" .source=${source}></uc-source-btn>`)}
        </uc-no-wrap-mode-smart-btn>
    `;
  }
}
