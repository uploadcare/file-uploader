import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import type { OutputCollectionState, OutputCollectionStatus } from '../../types';
import { UploadSource } from '../../utils/UploadSource';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

import './primary-action.css';
import '../Icon/Icon';
import '../Thumb/Thumb';

export class PrimaryAction extends LitUploaderBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-primary-action'];

  private static readonly SOURCE_TEXT_CONFIG: Record<string, { action: string }> = {
    [UploadSource.LOCAL]: { action: 'upload-from' },
    [UploadSource.URL]: { action: 'upload-from' },
    [UploadSource.CAMERA]: { action: 'take' },
    [UploadSource.MOBILE_PHOTO_CAMERA]: { action: 'take' },
    [UploadSource.MOBILE_VIDEO_CAMERA]: { action: 'record' },
  };

  @property({ attribute: 'custom-label' })
  public customLabel!: string;

  @property({ attribute: 'source', type: Object })
  public source?: SourceButtonConfig;

  @property({ attribute: 'entries', type: Object })
  public entries!: OutputCollectionState<OutputCollectionStatus, 'maybe-has-group'>;

  @state()
  private showIcon = false;

  public override initCallback(): void {
    super.initCallback();

    this.subConfigValue('smartBtnShowFirstIcon', (value) => {
      this.showIcon = value;
    });
  }

  private get hasEntries(): boolean {
    return (this.entries?.allEntries?.length ?? 0) > 0;
  }

  private get hasSingleSuccessImage(): boolean {
    return (
      this.entries?.allEntries?.length === 1 && this.entries.isSuccess && (this.entries.allEntries[0]?.isImage ?? false)
    );
  }

  private get hasMultipleEntries(): boolean {
    return (this.entries?.allEntries?.length ?? 0) > 1;
  }

  private get localizedSourceLabel(): string {
    return this.source?.label ? this.l10n(this.source.label).toLowerCase() : '';
  }

  private _translate(key: string, params?: Record<string, string | number>): string {
    return this.l10n(key, params);
  }

  private _headerTextDependentOnEntries(): string | undefined {
    if (this.entries?.status === 'uploading') {
      return this._translate('header-uploading', { count: this.entries.uploadingCount });
    }
    if (this.entries?.status === 'failed') {
      return this._translate('header-failed', { count: this.entries.failedCount });
    }
    if (this.entries?.status === 'success') {
      return this._translate('header-succeed', { count: this.entries.successCount });
    }
    return undefined;
  }

  private get textBasedOnLocale(): string {
    if (this.customLabel) {
      return this.customLabel;
    }

    const headerText = this._headerTextDependentOnEntries();
    if (headerText) {
      return headerText;
    }

    return this._getSourceLabelText();
  }

  private _getSourceLabelText(): string {
    if (!this.source?.id) {
      return '';
    }

    const config = PrimaryAction.SOURCE_TEXT_CONFIG[this.source.id];
    const action = config?.action ?? 'get-from';

    let sourceLabel: string;
    if (this.source.id === UploadSource.MOBILE_PHOTO_CAMERA) {
      sourceLabel = this.l10n('photo').toLowerCase();
    } else if (this.source.id === UploadSource.MOBILE_VIDEO_CAMERA) {
      sourceLabel = this.l10n('video').toLowerCase();
    } else {
      sourceLabel = this.localizedSourceLabel;
    }

    return this._translate(action, { source: sourceLabel });
  }

  private _handleClick() {
    if (this.hasEntries) {
      this._sharedInstancesBag.ctx.pub('*currentActivity', 'upload-list');
      this._sharedInstancesBag.modalManager?.open('upload-list');
      return;
    }

    void this.source?.onClick();
  }

  private _renderThumbnail() {
    if (this.hasSingleSuccessImage) {
      const entry = this.entries.allEntries[0];
      if (!entry) return null;
      return html`<uc-thumb .uid=${entry.internalId as any}></uc-thumb>`;
    }

    if (this.hasMultipleEntries) {
      return null;
    }

    const iconName = this.source?.icon;
    return this.showIcon && iconName ? html`<uc-icon .name=${iconName}></uc-icon>` : null;
  }

  protected override render() {
    return html`
      <button @click=${this._handleClick} aria-label=${this.textBasedOnLocale}>
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
