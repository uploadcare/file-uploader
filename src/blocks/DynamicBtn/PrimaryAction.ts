import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import type { Uid } from '../../lit/Uid';
import type { OutputCollectionState, OutputCollectionStatus } from '../../types';
import { UploadSource } from '../../utils/UploadSource';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

import './primary-action.css';
import '../Icon/Icon';
import '../Thumb/Thumb';

export class PrimaryAction extends LitUploaderBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-primary-action'];

  private static readonly DEFAULT_ICON = 'upload';

  private static readonly SOURCE_TEXT_CONFIG: Record<string, { action: string }> = {
    [UploadSource.LOCAL]: { action: 'upload-from' },
    [UploadSource.URL]: { action: 'upload-from' },
    [UploadSource.CAMERA]: { action: 'capture-with' },
    [UploadSource.MOBILE_PHOTO_CAMERA]: { action: 'take' },
    [UploadSource.MOBILE_VIDEO_CAMERA]: { action: 'record' },
  };

  @property({ type: Object })
  public source!: SourceButtonConfig | null;

  @property({ type: Object })
  public entries!: OutputCollectionState<OutputCollectionStatus, 'maybe-has-group'>;

  @state()
  private showIcon = false;

  @state()
  private _isMultiple = false;

  public override initCallback(): void {
    super.initCallback();

    this.subConfigValue('dynamicButtonShowFirstIcon', (value) => {
      this.showIcon = value;
    });

    this.subConfigValue('multiple', (value) => {
      this._isMultiple = value;
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
    return (this.entries?.allEntries?.length ?? 0) >= 1;
  }

  private get localizedSourceLabel(): string {
    if (!this.source?.label) return '';

    if (['local', 'url', 'camera'].includes(this.source?.id)) {
      return this.l10n(this.source.label).toLowerCase();
    }

    return this.l10n(this.source.label);
  }

  private _translate(key: string, params?: Record<string, string | number>): string {
    return this.l10n(key, params);
  }

  private get textBasedOnLocale(): string {
    const headerText = this._headerTextDependentOnEntries();
    if (headerText) {
      return headerText;
    }

    if (!this.source) {
      return this.l10n(this._isMultiple ? 'upload-files' : 'upload-file');
    }

    return this._getSourceLabelText();
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

    if (this.entries?.totalCount > 0) {
      return this._translate('header-total', { count: this.entries?.totalCount ?? 0 });
    } else {
      return undefined;
    }
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

    if (!this.source) {
      this.api.initFlow();
      return;
    }

    void this.source.onClick();
  }

  private _renderThumbnail() {
    if (!this._isMultiple && this.hasSingleSuccessImage) {
      const entry = this.entries.allEntries[0];
      if (!entry) return null;
      return html`<uc-thumb .uid=${entry.internalId as Uid}></uc-thumb>`;
    }

    if (this._isMultiple && this.hasMultipleEntries) {
      return null;
    }

    if (!this.source) {
      return html`<uc-icon .name=${PrimaryAction.DEFAULT_ICON}></uc-icon>`;
    }

    const iconName = this.source?.icon;
    return this.showIcon && iconName ? html`<uc-icon .name=${iconName}></uc-icon>` : null;
  }

  protected override render() {
    return html`
      <button type="button" @click=${this._handleClick} aria-label=${this.textBasedOnLocale}>
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
