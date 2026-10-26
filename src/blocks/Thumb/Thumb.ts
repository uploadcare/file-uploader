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
import { operationsFromModifiers } from '../../utils/cdn/operations';
import { preloadImage } from '../../utils/preloadImage';
import { generateThumb } from '../../utils/resizeImage';
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
  controller: AbortController;
  rafId?: number;
  cancel: () => void;
};

export class Thumb extends FileItemConfig {
  // All config/telemetry reads here are imperative side-effects of thumbnail
  // generation (not render reads), so they read the always-bound
  // `ConfigController`/`TelemetryManager` `@inject` fields imperatively
  // (`.get()` / method calls). The thumb image itself renders from the per-entry
  // `thumbUrl` observer, which has no DI token and stays on the v1 `subEntry`
  // path (step 8). `UploadCollectionController` is the entry source for
  // `_bindToEntry`, which only runs while adopted (`controllerReady` and the
  // render-gated `firstUpdated`/`updated`).
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;
  @inject(UploadCollectionController) private readonly _collection!: UploadCollectionController;

  @property({ type: String })
  public badgeIcon = '';

  @property({
    attribute: false,
  })
  public uid: Uid = '' as Uid;

  @state()
  private _thumbUrl = '';

  private _renderedGridOnce = false;

  private _thumbRect: IntersectionObserverEntry['boundingClientRect'] | null = null;

  private _isIntersecting = false;

  private _firstViewMode: ConfigType['filesViewMode'] | undefined;

  private _observer?: IntersectionObserver;

  private _pendingThumbUpdate?: PendingThumbUpdate;

  private _calculateThumbSize(force = false): number {
    if (force) {
      this._thumbRect = this.getBoundingClientRect();
    }

    let size = Math.max(
      parseInt(String(this?._thumbRect?.height || 0), 10),
      parseInt(String(this?._thumbRect?.width || 0), 10),
      this._config.get('thumbSize'),
    );

    if (window.devicePixelRatio > 1) {
      size *= window.devicePixelRatio;
    }

    return Math.min(Math.round(size), CDN_MAX_OUTPUT_DIMENSION);
  }

  // Runs as an adoption task (`runTask`): each await of outside work goes through `whileAdopted`, so a thumb released
  // mid-generation stops instead of reaching its `@inject` fields. A thumbnail that arrives late is still stored on the
  // entry (its `dispose`), since the entry outlives this block — a row scrolled out of the virtualized list keeps it.
  // biome-ignore lint/style/noInferrableTypes: Here the type is needed because `_withEntry` could not infer it correctly
  private _generateThumbnail = this.withEntry(async (entry, force: boolean = false) => {
    const fileInfo = entry.get('fileInfo');
    const isImage = entry.get('isImage');
    const uuid = entry.get('uuid');
    const currentThumbUrl = entry.get('thumbUrl');

    const size = this._calculateThumbSize(force);

    if (fileInfo && isImage && uuid) {
      let cdnThumbUrl: string | undefined;
      try {
        cdnThumbUrl = serializeFileUrl({
          origin: new URL(this._config.get('cdnCname')).origin,
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
        const storeThumb = () => {
          entry.set('thumbUrl', thumbUrl);
          if (currentThumbUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(currentThumbUrl);
          }
        };

        try {
          // `dispose` here commits rather than releases, on purpose: the entry outlives this row, so a thumbnail that
          // finishes after the row went away is still the entry's. The `generateThumb` awaits below do the same.
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
      entry.set('thumbUrl', this._placeholderThumb());
    }
  });

  /** Store a thumbnail drawn from the local file, or the placeholder if that fails. */
  private async _storeLocalThumb(entry: UploadEntryTypedData, file: File, size: number): Promise<void> {
    try {
      const thumbUrl = await this.whileAdopted(Promise.resolve(generateThumb(file, size)), (url) =>
        entry.set('thumbUrl', url),
      );
      entry.set('thumbUrl', thumbUrl);
    } catch (err) {
      if (isAbortError(err)) throw err;
      this._telemetry.sendEventError(err, 'thumbnail generation. Failed to generate thumb from file');
      entry.set('thumbUrl', this._placeholderThumb());
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
      if (this._thumbUrl) {
        this._thumbUrl = '';
      }
      return;
    }

    if (nextThumbUrl === this._thumbUrl) {
      return;
    }

    const abortController = new AbortController();
    const pending: PendingThumbUpdate = {
      controller: abortController,
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
        pending.rafId = window.requestAnimationFrame(() => {
          if (!abortController.signal.aborted) {
            this._thumbUrl = nextThumbUrl;
          }
        });
      })
      .catch((error) => {
        // Ignore decode failures (but don't run the success update path).
        if (abortController.signal.aborted) {
          return;
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        this._log.warn('Failed to decode thumbnail image', error);
      });
  }

  private _requestThumbGeneration(force = false): void {
    if (!this.entry) {
      return;
    }

    if (force) {
      this.runTask(() => this._generateThumbnail(true));
      return;
    }

    if (!this._isIntersecting) {
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

  private _observerCallback(entries: IntersectionObserverEntry[]): void {
    const [entry] = entries;
    if (!entry) {
      return;
    }
    this._isIntersecting = entry.isIntersecting;

    if (entry.isIntersecting) {
      this._thumbRect = entry.boundingClientRect;
      this._requestThumbGeneration();
      this._observer?.disconnect();
    }

    if (entry.intersectionRatio === 0) {
      cancelPending(this._debouncedGenerateThumb);
    }
  }

  protected override reset(): void {
    super.reset();
    cancelPending(this._debouncedGenerateThumb);
    this._cancelPendingThumbUpdate();
    if (this._thumbUrl) {
      this._thumbUrl = '';
    }
  }

  private _bindToEntry(): void {
    const id = this.uid?.trim() as Uid;
    if (!id) {
      if (this.entry) {
        this.reset();
      }
      return;
    }

    const entry = this._collection.read(id);
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

    this._requestThumbGeneration(true);
  }

  protected override controllerReady(_container: ControllerContainer): void {
    this._firstViewMode ??= this._config.get('filesViewMode');
    this._bindToEntry();
  }

  // Side effect (not a render read): a one-time thumb regeneration on the first
  // list->grid switch so the higher grid resolution is fetched. `beforeUpdate`
  // fires eagerly and synchronously on adoption — matching the former eager
  // `subConfigValue` fire, and after `controllerReady` sets `_firstViewMode` —
  // then again whenever `filesViewMode` changes.
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

  public override connectedCallback(): void {
    super.connectedCallback();

    this._observer?.disconnect();
    this._observer = new window.IntersectionObserver(this._observerCallback.bind(this), { threshold: 0.1 });

    this._observer.observe(this);
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();

    this._cancelPendingThumbUpdate();
    this._observer?.disconnect();
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
