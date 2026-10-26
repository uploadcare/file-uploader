import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { collectionHeader } from '../../abstract/collectionSummary';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { inject } from '../../abstract/di/inject';
import type { Uid } from '../../abstract/Uid';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { ACTIVITY_TYPES } from '../../lit/activity-constants';
import { ChildBlock } from '../../lit/ChildBlock';
import type { OutputCollectionState, OutputCollectionStatus } from '../../types';
import { UploadSource } from '../../utils/UploadSource';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

import './primary-action.css';
import '../Icon/Icon';
import '../Thumb/Thumb';

export class PrimaryAction extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-primary-action'];

  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(RouterController) private readonly _router!: RouterController;
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;

  private static readonly DEFAULT_ICON = 'upload';

  private static readonly SOURCE_TEXT_CONFIG: Record<string, { action: string }> = {
    [UploadSource.LOCAL]: { action: 'upload-from' },
    [UploadSource.URL]: { action: 'upload-from' },
    [UploadSource.CAMERA]: { action: 'capture-with' },
    [UploadSource.MOBILE_PHOTO_CAMERA]: { action: 'take' },
    [UploadSource.MOBILE_VIDEO_CAMERA]: { action: 'record' },
  };

  @property({ attribute: false })
  public source: SourceButtonConfig | null = null;

  @property({ attribute: false })
  public entries: OutputCollectionState<OutputCollectionStatus, 'maybe-has-group'> | null = null;

  // Config-derived render inputs read through the tracked signal path: reading
  // them in `render()`/`_renderThumbnail()` auto-tracks the key under
  // `SignalWatcher`, so a later `set()` re-renders — replacing the v1
  // `subConfigValue` subscriptions that mirrored these into `@state`.
  private get showIcon(): boolean {
    return this._config.getTracked('dynamicButtonShowFirstIcon');
  }

  private get _isMultiple(): boolean {
    return this._config.getTracked('multiple');
  }

  private get hasEntries(): boolean {
    return (this.entries?.allEntries?.length ?? 0) > 0;
  }

  private get hasSingleSuccessImage(): boolean {
    return (
      this.entries?.allEntries?.length === 1 && this.entries.isSuccess && (this.entries.allEntries[0]?.isImage ?? false)
    );
  }

  private get localizedSourceLabel(): string {
    if (!this.source?.label) return '';

    if ([UploadSource.LOCAL, UploadSource.URL, UploadSource.CAMERA].includes(this.source?.id)) {
      return this.l10n(this.source.label).toLowerCase();
    }

    return this.l10n(this.source.label);
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
    const entries = this.entries;
    if (!entries?.totalCount) return undefined;
    const { key, count } = collectionHeader({
      total: entries.totalCount,
      success: entries.successCount,
      uploading: entries.uploadingCount,
      failed: entries.failedCount,
      validatingBeforeUploading: entries.idleEntries?.filter((entry) => entry.isValidationPending).length ?? 0,
    });
    return this.l10n<string>(key, { count });
  }

  private _getSourceLabelText(): string {
    if (!this.source?.id) {
      return '';
    }

    const config = PrimaryAction.SOURCE_TEXT_CONFIG[this.source.id];
    const action = config?.action ?? 'get-from';

    let sourceLabel: string;
    if (this.source.id === UploadSource.MOBILE_PHOTO_CAMERA) {
      sourceLabel = this.l10n('src-type-mobile-photo-camera').toLowerCase();
    } else if (this.source.id === UploadSource.MOBILE_VIDEO_CAMERA) {
      sourceLabel = this.l10n('src-type-mobile-video-camera').toLowerCase();
    } else {
      sourceLabel = this.localizedSourceLabel;
    }

    return this.l10n<string>(action, { source: sourceLabel });
  }

  private _handleClick() {
    if (this.hasEntries) {
      this._router.navigate(ACTIVITY_TYPES.UPLOAD_LIST);
      return;
    }

    if (!this.source) {
      this._api.initFlow();
      return;
    }

    const { source } = this;
    this.runTask(() => source.onClick());
  }

  private _renderThumbnail() {
    if (!this._isMultiple && this.hasSingleSuccessImage) {
      const entry = this.entries?.allEntries[0];
      if (!entry) return null;
      return html`<uc-thumb .uid=${entry.internalId as Uid}></uc-thumb>`;
    }

    if (this._isMultiple && this.hasEntries) {
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
