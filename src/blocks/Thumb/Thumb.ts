import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { fileCssBg } from '../../blocks/svg-backgrounds/svg-backgrounds';
import '../../blocks/Thumb/thumb.css';
import { createCdnUrl, createCdnUrlModifiers, createOriginalUrl } from '../../utils/cdn-utils';
import { debounce } from '../../utils/debounce';
import { preloadImage } from '../../utils/preloadImage';
import { generateThumb } from '../../utils/resizeImage';
import { TRANSPARENT_PIXEL_SRC } from '../../utils/transparentPixelSrc';
import '../Icon/Icon';
import { ChildBlock } from '../../abstract/ChildBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import { proxyDeliveryUrl } from '../../abstract/secure-delivery';
import type { UploadEntry } from '../../abstract/UploadEntry';
import { UploadEntryController } from '../../abstract/UploadEntryController';

const CDN_MAX_OUTPUT_DIMENSION = 3000;

/**
 * v2 `<uc-thumb>`. Lazy-loads + decodes the thumbnail for an upload
 * entry. Entry comes in via the `entry` Lit property; reactivity wired
 * by `UploadEntryController` on the keys we care about
 * (`fileInfo` / `thumbUrl` / `cdnUrlModifiers`). v1's `thumb.css` styles
 * the tag directly.
 */
export class Thumb extends ChildBlock {
  @property({ attribute: false })
  public entry?: UploadEntry;

  @property({ type: String })
  public badgeIcon = '';

  @state()
  private _thumbUrl = '';

  private _entryCtrl?: UploadEntryController;
  private _isIntersecting = false;
  private _thumbRect: DOMRect | null = null;
  private _observer?: IntersectionObserver;
  private _pendingAbort: AbortController | null = null;

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [ctrl.config.subscribe.bind(ctrl.config)];
  }

  public override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate?.(changed);
    if (changed.has('entry')) this._bindEntry();
  }

  private _bindEntry(): void {
    this._entryCtrl?.hostDisconnected();
    this._entryCtrl = undefined;
    this._debouncedGenerate.cancel();
    this._pendingAbort?.abort();
    this._pendingAbort = null;
    this._thumbUrl = '';

    if (!this.entry) return;
    this._entryCtrl = new UploadEntryController(this, this.entry, {
      keys: ['fileInfo', 'thumbUrl', 'cdnUrlModifiers'],
      onChange: (key, value) => {
        if (key === 'fileInfo' && value && (value as { isImage?: boolean }).isImage) {
          void this._debouncedGenerate();
        } else if (key === 'thumbUrl') {
          this._scheduleThumbUpdate((value as string | null) ?? undefined);
        } else if (key === 'cdnUrlModifiers') {
          void this._debouncedGenerate();
        }
      },
    });
    if (this.isConnected) this._entryCtrl.hostConnected();
    this._scheduleThumbUpdate(this.entry.getValue('thumbUrl') ?? undefined);
    if (this._isIntersecting) void this._generateThumb(true);
  }

  private _calculateThumbSize(force = false): number {
    if (force) this._thumbRect = this.getBoundingClientRect();
    const cfg = this.uploaderOrNull?.config.values as { thumbSize?: number } | undefined;
    const baseSize = cfg?.thumbSize ?? 76;
    let size = Math.max(Math.floor(this._thumbRect?.height ?? 0), Math.floor(this._thumbRect?.width ?? 0), baseSize);
    if (window.devicePixelRatio > 1) size *= window.devicePixelRatio;
    return Math.min(size, CDN_MAX_OUTPUT_DIMENSION);
  }

  private async _generateThumb(force = false): Promise<void> {
    const entry = this.entry;
    const ctrl = this.uploaderOrNull;
    if (!entry || !ctrl) return;
    const cfg = ctrl.config.values as { cdnCname?: string };

    const fileInfo = entry.getValue('fileInfo');
    const isImage = entry.getValue('isImage');
    const uuid = entry.getValue('uuid');
    const currentThumbUrl = entry.getValue('thumbUrl');
    const size = this._calculateThumbSize(force);

    if (fileInfo && isImage && uuid) {
      const rawThumbUrl = createCdnUrl(
        createOriginalUrl(cfg.cdnCname ?? '', uuid),
        createCdnUrlModifiers(entry.getValue('cdnUrlModifiers'), 'stretch/off', `scale_crop/${size}x${size}/center`),
      );
      // Route through the secure-delivery proxy if configured.
      const thumbUrl = await proxyDeliveryUrl(rawThumbUrl, ctrl.config);
      if (currentThumbUrl === thumbUrl) return;
      const { promise } = preloadImage(thumbUrl);
      try {
        await promise;
        entry.setValue('thumbUrl', thumbUrl);
        if (currentThumbUrl?.startsWith('blob:')) URL.revokeObjectURL(currentThumbUrl);
      } catch {
        if (!currentThumbUrl?.startsWith('blob:')) {
          await this._generateLocalThumb(entry, size);
        }
      }
      return;
    }

    if (entry.getValue('thumbUrl')) return;
    const file = entry.getValue('file');
    if (file?.type.includes('image')) {
      await this._generateLocalThumb(entry, size);
    } else {
      const color = window.getComputedStyle(this).getPropertyValue('--uc-muted-foreground');
      entry.setValue('thumbUrl', fileCssBg(color));
    }
  }

  private async _generateLocalThumb(entry: UploadEntry, size: number): Promise<void> {
    try {
      const file = entry.getValue('file');
      if (!file) return;
      const blobThumbUrl = await generateThumb(file, size);
      entry.setValue('thumbUrl', blobThumbUrl);
    } catch {
      const color = window.getComputedStyle(this).getPropertyValue('--uc-muted-foreground');
      entry.setValue('thumbUrl', fileCssBg(color));
    }
  }

  private _debouncedGenerate = debounce(this._generateThumb.bind(this), 100);

  private _decodeImage(src: string, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      let image: HTMLImageElement | null = new Image();
      image.decoding = 'async';
      const cleanup = (): void => {
        if (!image) return;
        image.onload = null;
        image.onerror = null;
        image.src = TRANSPARENT_PIXEL_SRC;
        signal?.removeEventListener('abort', onAbort);
        image = null;
      };
      const onAbort = (): void => {
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (signal) {
        if (signal.aborted) return onAbort();
        signal.addEventListener('abort', onAbort, { once: true });
      }
      const ok = (): void => {
        cleanup();
        resolve();
      };
      const fail = (err: unknown): void => {
        cleanup();
        reject(err);
      };
      if (typeof image.decode === 'function') {
        image.src = src;
        image.decode().then(ok).catch(fail);
        return;
      }
      image.onload = ok;
      image.onerror = fail as OnErrorEventHandler;
      image.src = src;
    });
  }

  private _scheduleThumbUpdate(next?: string): void {
    this._pendingAbort?.abort();
    this._pendingAbort = null;
    if (!next) {
      this._thumbUrl = '';
      return;
    }
    if (next === this._thumbUrl) return;
    const abort = new AbortController();
    this._pendingAbort = abort;
    this._decodeImage(next, abort.signal)
      .then(() => {
        if (!abort.signal.aborted) {
          requestAnimationFrame(() => {
            if (!abort.signal.aborted) this._thumbUrl = next;
          });
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!abort.signal.aborted) console.warn('[uc-thumb] decode failed', err);
      });
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    this._observer?.disconnect();
    this._observer = new window.IntersectionObserver(
      ([e]) => {
        if (!e) return;
        this._isIntersecting = e.isIntersecting;
        if (e.isIntersecting) {
          this._thumbRect = e.boundingClientRect as DOMRect;
          if (this.entry) void this._debouncedGenerate();
          this._observer?.disconnect();
        }
        if (e.intersectionRatio === 0) this._debouncedGenerate.cancel();
      },
      { threshold: 0.1 },
    );
    this._observer.observe(this);
  }

  public override disconnectedCallback(): void {
    this._debouncedGenerate.cancel();
    this._pendingAbort?.abort();
    this._observer?.disconnect();
    this._entryCtrl?.hostDisconnected();
    super.disconnectedCallback();
  }

  public override render() {
    return html`
      <div class="uc-thumb">
        <img
          class="uc-thumb__img"
          src=${this._thumbUrl || TRANSPARENT_PIXEL_SRC}
          role="img"
          alt="Preview of uploaded image"
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

if (!customElements.get('uc-thumb')) customElements.define('uc-thumb', Thumb);
