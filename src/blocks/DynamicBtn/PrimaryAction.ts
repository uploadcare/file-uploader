import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { ACTIVITY_TYPES } from '../../abstract/activity-constants';
import { collectionHeader } from '../../abstract/collectionSummary';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { inject } from '../../abstract/di/inject';
import type { Uid } from '../../abstract/Uid';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { ChildBlock } from '../../lit/ChildBlock';
import type { OutputCollectionState, OutputCollectionStatus } from '../../types';
import { UploadSource } from '../../utils/UploadSource';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

import './primary-action.css';
import '../Icon/Icon';
import '../Thumb/Thumb';
import type { L10nKey } from '../../abstract/l10n';

export class PrimaryAction extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-primary-action'];

  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(RouterController) private readonly _router!: RouterController;
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;

  private static readonly DEFAULT_ICON = 'upload';

  /** The verb per built-in source; these read their source label lowercased. Other sources get `get-from`. */
  private static readonly SOURCE_ACTION: Record<string, L10nKey> = {
    [UploadSource.LOCAL]: 'upload-from',
    [UploadSource.URL]: 'upload-from',
    [UploadSource.CAMERA]: 'capture-with',
    [UploadSource.MOBILE_PHOTO_CAMERA]: 'take',
    [UploadSource.MOBILE_VIDEO_CAMERA]: 'record',
  };

  @property({ attribute: false })
  public source: SourceButtonConfig | null = null;

  @property({ attribute: false })
  public entries: OutputCollectionState<OutputCollectionStatus, 'maybe-has-group'> | null = null;

  // Config-derived render inputs read through the tracked signal path: reading
  // them in `render()`/`_renderThumbnail()` auto-tracks the key under
  // `SignalWatcher`, so a later `set()` re-renders.
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
    return this.l10n(key, { count });
  }

  private _getSourceLabelText(): string {
    const { source } = this;
    if (!source?.id) {
      return '';
    }
    const action = PrimaryAction.SOURCE_ACTION[source.id];
    const label = this.pluginLabel(source.label);
    return this.l10n(action ?? 'get-from', { source: action ? label.toLowerCase() : label });
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
