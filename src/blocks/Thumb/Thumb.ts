import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createCdnUrl, createCdnUrlModifiers, createOriginalUrl } from '../../utils/cdn-utils';
import { debounce } from '../../utils/debounce';
import { preloadImage } from '../../utils/preloadImage';
import { generateThumb } from '../../utils/resizeImage';
import { FileItemConfig } from '../FileItem/FileItemConfig';
import { fileCssBg } from '../svg-backgrounds/svg-backgrounds';
import './thumb.css';
import type { Uid } from '../../lit/Uid';
import { TRANSPARENT_PIXEL_SRC } from '../../utils/transparentPixelSrc';

const CDN_MAX_OUTPUT_DIMENSION = 3000;

type PendingThumbUpdate = {
  controller: AbortController;
  rafId?: number;
  cancel: () => void;
};

export class Thumb extends FileItemConfig {
  @property({ type: String })
  public badgeIcon = '';

  @property({ type: String })
  public uid: Uid = '' as Uid;

  @state()
  private _thumbUrl = '';

  private _renderedGridOnce = false;

  private _thumbRect: IntersectionObserverEntry['boundingClientRect'] | null = null;

  private _isIntersecting = false;

  private _firstViewMode = this.cfg.filesViewMode;

  private _observer?: IntersectionObserver;

  private _pendingThumbUpdate?: PendingThumbUpdate;

  private _calculateThumbSize(force = false): number {
    if (force) {
      this._thumbRect = this.getBoundingClientRect();
    }

    let size = Math.max(
      parseInt(String(this?._thumbRect?.height || 0), 10),
      parseInt(String(this?._thumbRect?.width || 0), 10),
      this.cfg.thumbSize,
    );

    if (window.devicePixelRatio > 1) {
      size *= window.devicePixelRatio;
    }

    return Math.min(size, CDN_MAX_OUTPUT_DIMENSION);
  }

  // biome-ignore lint/style/noInferrableTypes: Here the type is needed because `_withEntry` could not infer it correctly
  private _generateThumbnail = this.withEntry(async (entry, force: boolean = false) => {
    const fileInfo = entry.getValue('fileInfo');
    const isImage = entry.getValue('isImage');
    const uuid = entry.getValue('uuid');
    const currentThumbUrl = entry.getValue('thumbUrl');

    const size = this._calculateThumbSize(force);

    if (fileInfo && isImage && uuid) {
      const thumbUrl = await this.proxyUrl(
        createCdnUrl(
          createOriginalUrl(this.cfg.cdnCname, uuid),
          createCdnUrlModifiers(entry.getValue('cdnUrlModifiers'), `stretch/off`, `scale_crop/${size}x${size}/center`),
        ),
      );

      if (currentThumbUrl === thumbUrl) {
        return;
      }

      const { promise } = preloadImage(thumbUrl);

      promise
        .then(() => {
          entry.setValue('thumbUrl', thumbUrl);
          currentThumbUrl?.startsWith('blob:') && URL.revokeObjectURL(currentThumbUrl);
        })
        .catch(async () => {
          if (currentThumbUrl?.startsWith('blob:')) return;
          try {
            const file = entry.getValue('file');
            if (!file) return;
            const blobThumbUrl = await generateThumb(file, size);
            entry.setValue('thumbUrl', blobThumbUrl);
          } catch (err) {
            this.telemetryManager.sendEventError(err, 'thumbnail generation. Failed to generate thumb from file');
            const color = window.getComputedStyle(this).getPropertyValue('--uc-muted-foreground');
            entry.setValue('thumbUrl', fileCssBg(color));
          }
        });

      return;
    }

    if (entry.getValue('thumbUrl')) {
      return;
    }

    const file = entry.getValue('file');
    if (file?.type.includes('image')) {
      try {
        const thumbUrl = await generateThumb(file, size);
        entry.setValue('thumbUrl', thumbUrl);
      } catch (err) {
        this.telemetryManager.sendEventError(err, 'thumbnail generation. Failed to generate thumb from file');
        const color = window.getComputedStyle(this).getPropertyValue('--uc-muted-foreground');
        entry.setValue('thumbUrl', fileCssBg(color));
      }
    } else {
      const color = window.getComputedStyle(this).getPropertyValue('--uc-muted-foreground');
      entry.setValue('thumbUrl', fileCssBg(color));
    }
  });

  private _debouncedGenerateThumb = debounce(this._generateThumbnail.bind(this), 100);

  private _decodeImage(src: string, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      let image: HTMLImageElement | null = new Image();
      image.decoding = 'async';

      const cleanup = () => {
        if (!image) {
          return;
        }

        image.onload = null;
        image.onerror = null;
        image.src = TRANSPARENT_PIXEL_SRC;

        signal?.removeEventListener('abort', onAbort);

        image = null;
      };

      const onAbort = () => {
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      };

      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }

      const resolveSafe = () => {
        cleanup();
        resolve();
      };

      const rejectSafe = (error: unknown) => {
        cleanup();
        reject(error);
      };

      if (typeof image.decode === 'function') {
        image.src = src;
        image.decode().then(resolveSafe).catch(rejectSafe);
        return;
      }

      image.onload = resolveSafe;
      image.onerror = rejectSafe as OnErrorEventHandler;
      image.src = src;
    });
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

    this._decodeImage(nextThumbUrl, abortController.signal)
      .then(() => {
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
        console.warn('[Thumb] Failed to decode thumbnail image', error);
      });
  }

  private _requestThumbGeneration(force = false): void {
    if (!this.entry) {
      return;
    }

    if (force) {
      this._generateThumbnail(true);
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
      this._debouncedGenerateThumb.cancel();
    }
  }

  protected override reset(): void {
    super.reset();
    this._debouncedGenerateThumb.cancel();
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

    const entry = this.uploadCollection?.read(id);
    if (!entry || entry === this.entry) {
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

  public override initCallback(): void {
    super.initCallback();

    this.subConfigValue('filesViewMode', (viewMode) => {
      if (viewMode === 'grid' && !this._renderedGridOnce) {
        if (this._firstViewMode === 'list') {
          this._requestThumbGeneration(true);
        }
        this._renderedGridOnce = true;
      }
    });

    this.setAttribute('role', 'img');
  }

  public override connectedCallback(): void {
    super.connectedCallback();

    this._observer?.disconnect();
    this._observer = new window.IntersectionObserver(this._observerCallback.bind(this), { threshold: 0.1 });

    this._observer.observe(this);
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();

    this._debouncedGenerateThumb.cancel();
    this._cancelPendingThumbUpdate();
    this._observer?.disconnect();
  }

  public override render() {
    return html`
  <div class="uc-thumb">
    <img class="uc-thumb__img" src=${this._thumbUrl || TRANSPARENT_PIXEL_SRC} alt="" ?hidden=${!this._thumbUrl} draggable="false" />
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
