import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createCdnUrl, createCdnUrlModifiers, createOriginalUrl } from '../../utils/cdn-utils';
import { debounce } from '../../utils/debounce';
import { preloadImage } from '../../utils/preloadImage';
import { generateThumb } from '../../utils/resizeImage';
import { FileItemConfig } from '../FileItem/FileItemConfig';
import { fileCssBg } from '../svg-backgrounds/svg-backgrounds';
import './thumb.css';

const CDN_MAX_OUTPUT_DIMENSION = 3000;

type PendingThumbUpdate = {
  controller: AbortController;
  rafId?: number;
  cancel: () => void;
};

export class Thumb extends FileItemConfig {
  @property({ type: String })
  badgeIcon = '';

  @property({ type: String })
  uid = '';

  @state()
  private thumbUrl = '';

  private renderedGridOnce = false;

  private thumbRect: IntersectionObserverEntry['boundingClientRect'] | null = null;

  private isIntersecting = false;

  private firstViewMode = this.cfg.filesViewMode;

  private observer?: IntersectionObserver;

  private pendingThumbUpdate?: PendingThumbUpdate;

  private calculateThumbSize(force = false): number {
    if (force) {
      this.thumbRect = this.getBoundingClientRect();
    }

    let size = Math.max(
      parseInt(String(this?.thumbRect?.height || 0), 10),
      parseInt(String(this?.thumbRect?.width || 0), 10),
      this.cfg.thumbSize,
    );

    if (window.devicePixelRatio > 1) {
      size *= window.devicePixelRatio;
    }

    return Math.min(size, CDN_MAX_OUTPUT_DIMENSION);
  }

  // biome-ignore lint/style/noInferrableTypes: Here the type is needed because `_withEntry` could not infer it correctly
  private generateThumbnail = this._withEntry(async (entry, force: boolean = false) => {
    const fileInfo = entry.getValue('fileInfo');
    const isImage = entry.getValue('isImage');
    const uuid = entry.getValue('uuid');
    const currentThumbUrl = entry.getValue('thumbUrl');

    const size = this.calculateThumbSize(force);

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

  private debouncedGenerateThumb = debounce(this.generateThumbnail.bind(this), 100);

  private decodeImage(src: string, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';

      const cleanup = () => {
        image.src = '';
        signal?.removeEventListener('abort', onAbort);
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

  private cancelPendingThumbUpdate(): void {
    this.pendingThumbUpdate?.cancel();
    this.pendingThumbUpdate = undefined;
  }

  private scheduleThumbUpdate(nextThumbUrl?: string): void {
    this.cancelPendingThumbUpdate();

    if (!nextThumbUrl) {
      if (this.thumbUrl) {
        this.thumbUrl = '';
      }
      return;
    }

    if (nextThumbUrl === this.thumbUrl) {
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

    this.pendingThumbUpdate = pending;

    this.decodeImage(nextThumbUrl, abortController.signal)
      .catch(() => {})
      .then(() => {
        if (abortController.signal.aborted) {
          return;
        }
        pending.rafId = window.requestAnimationFrame(() => {
          if (!abortController.signal.aborted) {
            this.thumbUrl = nextThumbUrl;
          }
        });
      });
  }

  private requestThumbGeneration(force = false): void {
    if (!this._entry) {
      return;
    }

    if (force) {
      this.generateThumbnail(true);
      return;
    }

    if (!this.isIntersecting) {
      return;
    }

    this.debouncedGenerateThumb();
  }

  protected override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);
    this.bindToEntry();
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);
    if (changedProperties.has('uid')) {
      this.bindToEntry();
    }
  }

  private _observerCallback(entries: IntersectionObserverEntry[]): void {
    const [entry] = entries;
    if (!entry) {
      return;
    }
    this.isIntersecting = entry.isIntersecting;

    if (entry.isIntersecting) {
      this.thumbRect = entry.boundingClientRect;
      this.requestThumbGeneration();
      this.observer?.disconnect();
    }

    if (entry.intersectionRatio === 0) {
      this.debouncedGenerateThumb.cancel();
    }
  }

  protected override _reset(): void {
    super._reset();
    this.debouncedGenerateThumb.cancel();
    this.cancelPendingThumbUpdate();
    if (this.thumbUrl) {
      this.thumbUrl = '';
    }
  }

  private bindToEntry(): void {
    const id = this.uid?.trim();
    if (!id) {
      if (this._entry) {
        this._reset();
      }
      return;
    }

    const entry = this.uploadCollection?.read(id);
    if (!entry || entry === this._entry) {
      return;
    }

    this._reset();
    this._entry = entry;

    const requestThumb = () => {
      this.requestThumbGeneration();
    };

    this._subEntry('fileInfo', (fileInfo) => {
      if (fileInfo?.isImage) {
        requestThumb();
      }
    });

    this._subEntry('thumbUrl', (thumbUrl) => {
      this.scheduleThumbUpdate(thumbUrl ?? undefined);
    });

    this._subEntry('cdnUrlModifiers', requestThumb);

    this.requestThumbGeneration(true);
  }

  override initCallback(): void {
    super.initCallback();

    this.subConfigValue('filesViewMode', (viewMode) => {
      if (viewMode === 'grid' && !this.renderedGridOnce) {
        if (this.firstViewMode === 'list') {
          this.requestThumbGeneration(true);
        }
        this.renderedGridOnce = true;
      }
    });

    this.setAttribute('role', 'img');
    this.setAttribute('alt', 'Preview of uploaded image');
  }

  override connectedCallback(): void {
    super.connectedCallback();

    this.observer?.disconnect();
    this.observer = new window.IntersectionObserver(this._observerCallback.bind(this), { threshold: 0.1 });

    this.observer.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    this.debouncedGenerateThumb.cancel();
    this.cancelPendingThumbUpdate();
    this.observer?.disconnect();
  }

  override render() {
    return html`
  <div class="uc-thumb">
    <img class="uc-thumb__img" src=${this.thumbUrl || ''} alt="" ?hidden=${!this.thumbUrl} draggable="false" />
    <div class="uc-badge">
      <uc-icon name=${this.badgeIcon}></uc-icon>
    </div>
  </div>
`;
  }
}
