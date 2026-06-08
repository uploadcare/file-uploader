import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import '../../blocks/DynamicBtn/primary-action.css';
import { UploadSource } from '../../utils/UploadSource';
import '../Icon/Icon';
import '../Thumb/Thumb';
import { ChildBlock } from '../../abstract/ChildBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import type { OutputCollectionState, OutputCollectionStatus } from '../../types/exported';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

/**
 * v2 `<uc-primary-action>`. The main button surface inside DynamicBtn.
 * State-driven text (`upload from <source>`, `header-uploading`,
 * `header-succeed`, etc.) plus optional source icon or single-file
 * thumbnail. Clicking either invokes the source's `onClick` (when no
 * files yet) or opens the upload list (when files exist).
 *
 * Mirrors v1's `PrimaryAction.ts` 1:1 but uses v2 controllers and the
 * v2 `OutputCollectionState` shape (now identical to v1's).
 */
export class PrimaryAction extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-primary-action'];

  private static readonly SOURCE_TEXT_CONFIG: Record<string, { action: string }> = {
    [UploadSource.LOCAL]: { action: 'upload-from' },
    [UploadSource.URL]: { action: 'upload-from' },
    [UploadSource.CAMERA]: { action: 'capture-with' },
    [UploadSource.MOBILE_PHOTO_CAMERA]: { action: 'take' },
    [UploadSource.MOBILE_VIDEO_CAMERA]: { action: 'record' },
  };

  @property({ type: Object })
  public source: SourceButtonConfig | null = null;

  @property({ type: Object })
  public entries: OutputCollectionState<OutputCollectionStatus, 'maybe-has-group'> | null = null;

  @state()
  private _showIcon = true;

  @state()
  private _isMultiple = true;

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [ctrl.locale.subscribe.bind(ctrl.locale), ctrl.config.subscribe.bind(ctrl.config)];
  }

  protected override willUpdate(_changed: PropertyValues<this>): void {
    super.willUpdate?.(_changed);
    const cfg = this.uploaderOrNull?.config.values as
      | { dynamicButtonShowFirstIcon?: boolean; multiple?: boolean }
      | undefined;
    if (cfg) {
      this._showIcon = cfg.dynamicButtonShowFirstIcon ?? true;
      this._isMultiple = cfg.multiple ?? true;
    }
  }

  private get _hasEntries(): boolean {
    return (this.entries?.allEntries?.length ?? 0) > 0;
  }

  private get _hasSingleSuccessImage(): boolean {
    const all = this.entries?.allEntries;
    return !!all && all.length === 1 && this.entries?.isSuccess === true && (all[0]?.isImage ?? false);
  }

  private get _hasMultipleEntries(): boolean {
    return (this.entries?.allEntries?.length ?? 0) >= 1;
  }

  private _t(key: string, params?: Record<string, string | number>): string {
    return this.uploaderOrNull?.locale.t(key, params) ?? key;
  }

  private _localizedSourceLabel(): string {
    const src = this.source;
    if (!src?.label) return '';
    const lower = ['local', 'url', 'camera'].includes(src.id);
    const text = this._t(src.label);
    return lower ? text.toLowerCase() : text;
  }

  private _headerTextForEntries(): string | undefined {
    const e = this.entries;
    if (!e) return undefined;
    if (e.status === 'uploading') return this._t('header-uploading', { count: e.uploadingCount });
    if (e.status === 'failed') return this._t('header-failed', { count: e.failedCount });
    if (e.status === 'success') return this._t('header-succeed', { count: e.successCount });
    if (e.totalCount > 0) return this._t('header-total', { count: e.totalCount });
    return undefined;
  }

  private _sourceLabelText(): string {
    const src = this.source;
    if (!src?.id) return '';
    const action = PrimaryAction.SOURCE_TEXT_CONFIG[src.id]?.action ?? 'get-from';
    let sourceLabel: string;
    if (src.id === UploadSource.MOBILE_PHOTO_CAMERA) {
      sourceLabel = this._t('photo').toLowerCase();
    } else if (src.id === UploadSource.MOBILE_VIDEO_CAMERA) {
      sourceLabel = this._t('video').toLowerCase();
    } else {
      sourceLabel = this._localizedSourceLabel();
    }
    return this._t(action, { source: sourceLabel });
  }

  private get _label(): string {
    return this._headerTextForEntries() ?? this._sourceLabelText();
  }

  private _handleClick = (): void => {
    if (this._hasEntries) {
      // Files exist — surface the upload list. Routes through the
      // preset's strategy so regular opens it in a modal, inline /
      // minimal swap the background activity to the inline list.
      this.uploader.router.navigate('upload-list');
      return;
    }
    void this.source?.onClick();
  };

  private _renderLeading() {
    if (!this._isMultiple && this._hasSingleSuccessImage) {
      const entry = this.entries?.allEntries[0];
      if (!entry) return null;
      const live = this.uploaderOrNull?.collection.read(entry.internalId);
      return live ? html`<uc-thumb .entry=${live}></uc-thumb>` : null;
    }
    if (this._isMultiple && this._hasMultipleEntries) return null;
    const iconName = this.source?.icon;
    return this._showIcon && iconName ? html`<uc-icon .name=${iconName}></uc-icon>` : null;
  }

  public override render() {
    const label = this._label;
    return html`
      <button type="button" @click=${this._handleClick} aria-label=${label}>
        ${this._renderLeading()}
        <span>${label}</span>
      </button>
    `;
  }
}

if (!customElements.get('uc-primary-action')) customElements.define('uc-primary-action', PrimaryAction);

// Tag is globally declared by v1's `src/blocks/DynamicBtn/PrimaryAction.ts`.
