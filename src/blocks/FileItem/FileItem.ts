import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import '../../blocks/FileItem/file-item.css';
import { canonicalSourceName, ExternalUploadSource } from '../../utils/UploadSource';
import './FileActionButton';
import '../Icon/Icon';
import '../Thumb/Thumb';
import { ChildBlock } from '../../abstract/ChildBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import { getOutputItem } from '../../abstract/output-collection-state';
import type { UploadEntry } from '../../abstract/UploadEntry';
import { UploadEntryController } from '../../abstract/UploadEntryController';
import type { OutputFileEntry } from '../../types/exported';

type FileItemState =
  | 'idle'
  | 'finished'
  | 'failed'
  | 'uploading'
  | 'validation'
  | 'queued-uploading'
  | 'queued-validation';

const TRACKED_KEYS = [
  'fileName',
  'externalUrl',
  'fileInfo',
  'isUploading',
  'isQueuedForUploading',
  'isValidationPending',
  'isQueuedForValidation',
  'uploadProgress',
  'errors',
  'fileSize',
  'mimeType',
  'isImage',
  'source',
] as const;

/**
 * v2 `<uc-file-item>`. Per-entry row in the upload list. Derives a state
 * (idle/validation/uploading/finished/failed) from the entry's reactive
 * fields and renders the thumb + filename + progress + remove/upload
 * buttons + plugin file actions.
 *
 * The entry is injected via the `entry` Lit property; reactivity is
 * wired by `UploadEntryController`. Upload itself is owned by
 * `controller.upload` — the inline "upload" button just calls
 * `upload.run(entry)`.
 */
export class FileItem extends ChildBlock {
  @property({ attribute: false })
  public entry?: UploadEntry;

  private _entryCtrl?: UploadEntryController;
  private _observer?: IntersectionObserver;
  @state() private _visible = false;

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [
      ctrl.config.subscribe.bind(ctrl.config),
      ctrl.locale.subscribe.bind(ctrl.locale),
      ctrl.plugins.subscribe.bind(ctrl.plugins),
    ];
  }

  public override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate?.(changed);
    if (changed.has('entry')) this._bindEntry();
  }

  private _bindEntry(): void {
    if (this._entryCtrl) {
      this._entryCtrl.hostDisconnected();
      this._entryCtrl = undefined;
    }
    if (this.entry) {
      this._entryCtrl = new UploadEntryController(this, this.entry, {
        keys: [...TRACKED_KEYS],
      });
    }
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    this._observer = new window.IntersectionObserver(
      ([e]) => {
        if (!e) return;
        if (e.isIntersecting && !this._visible) {
          this._visible = true;
          this._observer?.disconnect();
        }
      },
      { threshold: [0, 0.1] },
    );
    this._observer.observe(this);
  }

  public override disconnectedCallback(): void {
    this._observer?.disconnect();
    this._entryCtrl?.hostDisconnected();
    super.disconnectedCallback();
  }

  public override updated(): void {
    const mode = (this.uploaderOrNull?.config.values as { filesViewMode?: string })?.filesViewMode;
    if (mode) this.setAttribute('mode', mode);
  }

  // ─── Derived state (read fresh from entry each render) ────────────────

  private _t(key: string, vars?: Record<string, unknown>): string {
    return this.uploaderOrNull?.locale.t(key, vars) ?? key;
  }

  private _state(): FileItemState {
    const e = this.entry;
    if (!e) return 'idle';
    if (e.getValue('errors').length > 0) return 'failed';
    if (e.getValue('isQueuedForUploading')) return 'queued-uploading';
    if (e.getValue('isQueuedForValidation')) return 'queued-validation';
    if (e.getValue('isValidationPending')) return 'validation';
    if (e.getValue('isUploading')) return 'uploading';
    if (e.getValue('fileInfo')) return 'finished';
    return 'idle';
  }

  private _itemName(): string {
    const e = this.entry;
    if (!e) return '';
    return e.getValue('fileName') || e.getValue('externalUrl') || this._t('file-no-name');
  }

  private _hint(): string {
    const e = this.entry;
    if (!e) return '';
    if (this._state() === 'finished') return '';
    if (e.getValue('errors').length > 0) return '';
    const source = e.getValue('source');
    const externalUrl = e.getValue('externalUrl');
    if (!externalUrl || !source) return '';
    if (!(Object.values(ExternalUploadSource) as string[]).includes(source)) return '';
    return this._t('waiting-for', {
      source: this._t(`src-type-${canonicalSourceName(source)}`),
    });
  }

  // ─── Handlers ─────────────────────────────────────────────────────────

  private _handleRemove = (): void => {
    if (!this.entry) return;
    // Abort an in-flight upload before removing so the request doesn't keep
    // running (and firing progress) after the entry is gone.
    this.entry.getValue('abortController')?.abort();
    this.uploader.api.removeFileByInternalId(this.entry.internalId);
  };

  private _handleUploadClick = (): void => {
    if (!this.entry) return;
    void this.uploader.upload.run(this.entry);
  };

  // ─── Render ───────────────────────────────────────────────────────────

  public override render() {
    const entry = this.entry;
    if (!entry) return html``;
    if (!this._visible) return html`<div class="uc-inner"></div>`;
    const state = this._state();
    const isFinished = state === 'finished';
    const isFailed = state === 'failed';
    const isUploading = state === 'uploading';
    const badgeIcon = isFailed ? 'badge-error' : isFinished ? 'badge-success' : '';
    const cfg = this.uploaderOrNull?.config.values as
      | { filesViewMode?: string; gridShowFileNames?: boolean }
      | undefined;
    const showFileNames = cfg?.filesViewMode === 'list' || !!cfg?.gridShowFileNames;
    const errorText = (entry.getValue('errors')[0] as { message?: string } | undefined)?.message ?? '';
    const fileName = entry.getValue('fileName');
    const ariaLabelStatus = fileName ? this._t('a11y-file-item-status', { fileName, status: state }) : '';
    // v1 shows upload progress via the spinner in `<uc-file-action-button>`
    // (no inline progress-bar), so we only need the boolean.
    const progressVisible =
      state === 'uploading' || state === 'queued-uploading' || state === 'queued-validation' || state === 'validation';
    // Upload progress (0–100) shown as a ring on the action button; pre-upload
    // validation/queue states have no meaningful percentage yet.
    const progressValue =
      state === 'queued-validation' || state === 'validation' ? 0 : (entry.getValue('uploadProgress') ?? 0);
    // Hide the remove glyph while the file is actively uploading/queued so the
    // button reads as a spinner, not a remove affordance.
    const hideRemove = state === 'uploading' || state === 'queued-uploading';

    const snap = this._snapshot(entry);
    const visibleActions = (this.uploaderOrNull?.plugins.actions ?? []).filter((a) => {
      try {
        return a.shouldRender ? a.shouldRender(snap) : true;
      } catch {
        return false;
      }
    });

    return html`
      <div
        class="uc-inner"
        ?data-finished=${isFinished}
        ?data-uploading=${isUploading}
        ?data-failed=${isFailed}
      >
        <uc-thumb .entry=${entry} .badgeIcon=${badgeIcon}></uc-thumb>
        <div
          aria-atomic="true"
          aria-live="polite"
          class="uc-file-name-wrapper"
          aria-label=${ariaLabelStatus}
        >
          <span class="uc-file-name" ?hidden=${!showFileNames}>${this._itemName()}</span>
          <span class="uc-file-error" ?hidden=${!errorText}>${errorText}</span>
          <span class="uc-file-hint" ?hidden=${!this._hint()}>${this._hint()}</span>
        </div>
        <div class="uc-file-actions">
          ${visibleActions.map(
            (a) => html`
              <button
                type="button"
                @click=${() => {
                  try {
                    void a.onClick(snap);
                  } catch (err) {
                    console.warn(`[v2/plugins] action "${a.id}" onClick threw`, err);
                  }
                }}
                title=${this._t(a.label ?? a.id)}
                aria-label=${this._t(a.label ?? a.id)}
                class="uc-plugin-action-btn uc-mini-btn"
                data-plugin-action-id=${a.id}
              >
                <uc-icon name=${a.icon ?? a.id}></uc-icon>
              </button>
            `,
          )}
          <uc-file-action-button
            @uc:remove=${this._handleRemove}
            .uploading=${progressVisible}
            .progress=${progressValue}
            .hideRemove=${hideRemove}
            .failed=${isFailed}
            .success=${isFinished}
          ></uc-file-action-button>
          <button
            type="button"
            class="uc-upload-btn uc-mini-btn"
            @click=${this._handleUploadClick}
          >
            <uc-icon name="upload"></uc-icon>
          </button>
        </div>
      </div>
    `;
  }

  private _snapshot(entry: UploadEntry): OutputFileEntry {
    return getOutputItem(entry);
  }
}

if (!customElements.get('uc-file-item')) customElements.define('uc-file-item', FileItem);
