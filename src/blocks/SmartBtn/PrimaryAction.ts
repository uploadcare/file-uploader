import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import type { OutputCollectionState, OutputCollectionStatus } from '../../types';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

import './primary-action.css';

export class PrimaryAction extends LitUploaderBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-primary-action'];

  @property({ attribute: 'custom-label' })
  public customLabel!: string;

  @property()
  public source?: SourceButtonConfig;

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

  private _wr(key, params) {
    return this.l10n(key, params);
  }

  private _headerTextDependentOnEntries() {
    if (this.entries?.status === 'uploading') {
      return this._wr('header-uploading', { count: this.entries.uploadingCount });
    }
    if (this.entries?.status === 'failed') {
      return this._wr('header-failed', { count: this.entries.failedCount });
    }
    if (this.entries?.status === 'success') {
      return this._wr('header-succeed', { count: this.entries.successCount });
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
        return this._wr('upload-from', { source: this.l10n(this.source.label).toLowerCase() });
      case 'camera':
        return this._wr('take', { source: this.l10n(this.source.label).toLowerCase() });
      case 'mobile-photo-camera':
        return this._wr('take', { source: this.l10n('photo').toLowerCase() });
      case 'mobile-video-camera':
        return this._wr('record', { source: this.l10n('video').toLowerCase() });
      case 'url':
        return this._wr('upload-from', { source: this.l10n(this.source.label).toLowerCase() });
      default:
        return this._wr('get-from', { source: this.l10n(this.source.label).toLowerCase() });
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

declare global {
  interface HTMLElementTagNameMap {
    'uc-primary-action': PrimaryAction;
  }
}
