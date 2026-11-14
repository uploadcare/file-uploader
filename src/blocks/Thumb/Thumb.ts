import { modifiers, serializeFileUrl } from '@uploadcare/cdn-url';
import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import { inject } from '../../abstract/di/inject';
import { isAbortError } from '../../abstract/di/Lifetime';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { effect } from '../../lit/effect';
import { cancelPending, debounced } from '../../lit/rate-limited-method';
import { ThumbnailController } from '../../lit/ThumbnailController';
import { operationsFromModifiers } from '../../utils/cdn/operations';
import { preloadImage } from '../../utils/preloadImage';
import { FileItemConfig } from '../FileItem/FileItemConfig';
import { fileCssBg } from '../svg-backgrounds/svg-backgrounds';
import './thumb.css';
import type { ControllerContainer } from '../../abstract/di/ControllerContainer';
import type { Uid } from '../../abstract/Uid';
import type { UploadEntryTypedData } from '../../abstract/uploadEntrySchema';
import type { ConfigType } from '../../types';
import { TRANSPARENT_PIXEL_SRC } from '../../utils/transparentPixelSrc';

import '../Icon/Icon';

const CDN_MAX_OUTPUT_DIMENSION = 3000;

type PendingThumbUpdate = {
  rafId?: number;
  cancel: () => void;
};

export class Thumb extends FileItemConfig {
  // All config/telemetry reads here are imperative side-effects of thumbnail
  // generation (not render reads), so they read the always-bound
  // `ConfigController`/`TelemetryManager` `@inject` fields imperatively
  // (`.get()` / method calls). The thumb image itself renders from the per-entry
  // `thumbUrl` observer (`subEntry`). `UploadCollectionController` is the entry source for
  // `_bindToEntry`, which only runs while adopted (`controllerReady` and the
  // render-gated `firstUpdated`/`updated`). `ThumbnailController` owns the
  // thumbnail itself: this block asks it to draw or store one and shows the result.
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;
  @inject(UploadCollectionController) private readonly _collection!: UploadCollectionController;
  @inject(ThumbnailController) private readonly _thumbnails!: ThumbnailController;

  @property({ type: String })
  public badgeIcon = '';

  @property({
    attribute: false,
  })
  public uid: Uid = '' as Uid;

  @state()
  private _thumbUrl = '';

  private _renderedGridOnce = false;

  private _firstViewMode: ConfigType['filesViewMode'] | undefined;

  private _pendingThumbUpdate?: PendingThumbUpdate;

  /** The thumbnail being generated, so a second request for the same one does not start over. */
  private _generating?: string;

  private _calculateThumbSize(): number {
    const rect = this.getBoundingClientRect();
    let size = Math.max(Math.trunc(rect.height), Math.trunc(rect.width), this._config.get('thumbSize'));

    if (window.devicePixelRatio > 1) {
      size *= window.devicePixelRatio;
    }

    return Math.min(Math.round(size), CDN_MAX_OUTPUT_DIMENSION);
  }

  // Runs as an adoption task (`runTask`): each await of outside work goes through `whileAdopted`, so a thumb released
  // mid-generation stops instead of reaching its `@inject` fields. A thumbnail that arrives late is still stored on the
  // entry, since the entry outlives this block — a row scrolled out of the virtualized list keeps it.
  private async _generateThumbnail(): Promise<void> {
    const entry = this.entry;
    if (!entry) return;
    const size = this._calculateThumbSize();
    const uuid = entry.get('fileInfo') && entry.get('isImage') && entry.get('uuid');
    // Binding to the entry and a change of the entry each ask for a thumbnail, the second while the first may still be
    // decoding the file. A local thumbnail is drawn once whatever the size; a CDN one differs by size and operations.
    const job = uuid ? `${uuid}/${size}/${entry.get('cdnUrlModifiers')}` : 'local';
    if (this._generating === job) return;
    this._generating = job;
    try {
      await this._generate(entry, size);
    } finally {
      if (this._generating === job) this._generating = undefined;
    }
  }

  private async _generate(entry: UploadEntryTypedData, size: number): Promise<void> {
    const fileInfo = entry.get('fileInfo');
    const isImage = entry.get('isImage');
    const uuid = entry.get('uuid');
    const currentThumbUrl = entry.get('thumbUrl');

    if (fileInfo && isImage && uuid) {
      let cdnThumbUrl: string | undefined;
      try {
        cdnThumbUrl = serializeFileUrl({
          cdnBase: new URL(this._config.get('cdnCname')).origin,
          uuid,
          operations: [
            ...operationsFromModifiers(entry.get('cdnUrlModifiers')),
            ...operationsFromModifiers(modifiers('stretch/off', `scale_crop/${size}x${size}/center`)),
          ],
        });
      } catch (err) {
        // Both inputs here can be malformed: `cdnUrlModifiers` is writable by
        // plugins (`buildPluginApi`) and `cdnCname` is user config. Thumbnail
        // generation runs fire-and-forget (`_debouncedGenerateThumb`, plus the
        // forced call on resize), so a throw would end the task and leave no
        // thumbnail at all. Fall through to the local-file/placeholder path
        // below — where a broken CDN URL used to land anyway, via its preload
        // failure.
        this._telemetry.sendEventError(err, 'thumbnail generation. Failed to build a CDN thumbnail URL');
      }

      if (cdnThumbUrl) {
        const thumbUrl = await this.whileAdopted(this.proxyUrl(cdnThumbUrl));

        if (currentThumbUrl === thumbUrl) {
          return;
        }

        const { promise } = preloadImage(thumbUrl);
        // Read while adopted: `storeThumb` also runs after release, where the `@inject` field no longer resolves.
        const thumbnails = this._thumbnails;
        const storeThumb = () => thumbnails.store(entry, thumbUrl);

        try {
          // `dispose` here commits rather than releases, on purpose: the entry outlives this row, so a thumbnail that
          // finishes after the row went away is still the entry's. A local one drawn below is kept the same way.
          await this.whileAdopted(promise, storeThumb);
          storeThumb();
        } catch (error) {
          if (isAbortError(error)) throw error;
          if (currentThumbUrl?.startsWith('blob:')) return;
          const file = entry.get('file');
          if (file) await this._storeLocalThumb(entry, file, size);
        }

        return;
      }
    }

    if (entry.get('thumbUrl')) {
      return;
    }

    const file = entry.get('file');
    if (file?.type.includes('image')) {
      await this._storeLocalThumb(entry, file, size);
    } else {
      this._thumbnails.store(entry, this._placeholderThumb());
    }
  }

  /** Store a thumbnail drawn from the local file, or the placeholder if that fails. */
  private async _storeLocalThumb(entry: UploadEntryTypedData, file: Blob, size: number): Promise<void> {
    try {
      // Drawn and stored by the entry's one drawing, which this thumb joins if another thumb of the entry asked first.
      await this.whileAdopted(this._thumbnails.draw(entry, file, size, this.adoptionSignal));
    } catch (err) {
      if (isAbortError(err)) throw err;
      this._telemetry.sendEventError(err, 'thumbnail generation. Failed to generate thumb from file');
      this._thumbnails.store(entry, this._placeholderThumb());
    }
  }

  private _placeholderThumb(): string {
    return fileCssBg(window.getComputedStyle(this).getPropertyValue('--uc-muted-foreground'));
  }

  // `@debounced` drops a call after release and cancels a pending one on release.
  /** @internal */
  @debounced(100)
  protected _debouncedGenerateThumb(): void {
    this.runTask(() => this._generateThumbnail());
  }

  private _cancelPendingThumbUpdate(): void {
    this._pendingThumbUpdate?.cancel();
    this._pendingThumbUpdate = undefined;
  }

  private _scheduleThumbUpdate(nextThumbUrl?: string): void {
    this._cancelPendingThumbUpdate();

    if (!nextThumbUrl) {
      this._thumbUrl = '';
      return;
    }

    if (nextThumbUrl === this._thumbUrl) {
      return;
    }

    const abortController = new AbortController();
    const pending: PendingThumbUpdate = {
      cancel: () => {
        abortController.abort();
        if (pending.rafId !== undefined) {
          window.cancelAnimationFrame(pending.rafId);
        }
      },
    };

    this._pendingThumbUpdate = pending;

    preloadImage(nextThumbUrl, { signal: abortController.signal, decode: true })
      .promise.then(() => {
        if (abortController.signal.aborted) {
          return;
        }
        // `cancel` cancels this frame, so it never runs after an abort.
        pending.rafId = window.requestAnimationFrame(() => {
          this._thumbUrl = nextThumbUrl;
        });
      })
      .catch((error) => {
        // An abort is ours; anything else is a decode failure, which skips the success path.
        if (!abortController.signal.aborted) this._log.warn('Failed to decode thumbnail image', error);
      });
  }

  // A thumb is only in the DOM once its row is at or near the viewport (`FileItem` holds its render until then), so
  // it has nothing to wait for. `now` skips the debounce that collects a burst of entry changes.
  private _requestThumbGeneration(now = false): void {
    if (!this.entry) {
      return;
    }

    if (now) {
      this.runTask(() => this._generateThumbnail());
      return;
    }

    this._debouncedGenerateThumb();
  }

  protected override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);
    this._bindToEntry();
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);
    if (changedProperties.has('uid')) {
      this._bindToEntry();
    }
  }

  protected override reset(): void {
    super.reset();
    cancelPending(this._debouncedGenerateThumb);
    this._cancelPendingThumbUpdate();
    this._generating = undefined;
    this._thumbUrl = '';
  }

  private _bindToEntry(): void {
    const id = this.uid;
    const entry = id ? this._collection.read(id) : null;
    if (!entry) {
      // The uid no longer resolves (entry removed, scope lost, or uid swapped
      // to an unknown id) — drop the previous entry's subscriptions and image
      // instead of keeping a stale thumb alive.
      if (this.entry) {
        this.reset();
      }
      return;
    }
    if (entry === this.entry) {
      return;
    }

    this.reset();
    this.entry = entry;

    const requestThumb = () => {
      this._requestThumbGeneration();
    };

    this.subEntry('fileInfo', (fileInfo) => {
      if (fileInfo?.isImage) {
        requestThumb();
      }
    });

    this.subEntry('thumbUrl', (thumbUrl) => {
      this._scheduleThumbUpdate(thumbUrl ?? undefined);
    });

    this.subEntry('cdnUrlModifiers', requestThumb);

    // The subscriptions above each asked on subscribing; the request below answers them all.
    cancelPending(this._debouncedGenerateThumb);
    this._requestThumbGeneration(true);
  }

  protected override controllerReady(_container: ControllerContainer): void {
    this._firstViewMode ??= this._config.get('filesViewMode');
    this._bindToEntry();
  }

  // Side effect (not a render read): a one-time thumb regeneration on the first
  // list->grid switch so the higher grid resolution is fetched. `beforeUpdate`
  // fires eagerly and synchronously on adoption — after `controllerReady` sets
  // `_firstViewMode` — then again whenever `filesViewMode` changes.
  /** @internal */
  @effect({ beforeUpdate: true })
  protected _regenerateThumbOnGridSwitch(): void {
    if (this._config.getTracked('filesViewMode') === 'grid' && !this._renderedGridOnce) {
      if (this._firstViewMode === 'list') {
        this._requestThumbGeneration(true);
      }
      this._renderedGridOnce = true;
    }
  }

  public override render() {
    return html`
  <div class="uc-thumb">
    <img
      class="uc-thumb__img"
      src=${this._thumbUrl || TRANSPARENT_PIXEL_SRC}
      alt=""
      ?hidden=${!this._thumbUrl}
      draggable="false"
    />
    <div class="uc-badge">
      <uc-icon name=${this.badgeIcon}></uc-icon>
    </div>
  </div>
`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-thumb': Thumb;
  }
}
