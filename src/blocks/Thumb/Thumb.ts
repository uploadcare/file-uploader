import { createCdnUrl, createCdnUrlModifiers, createOriginalUrl } from '../../utils/cdn-utils';
import { debounce } from '../../utils/debounce';
import { preloadImage } from '../../utils/preloadImage';
import { generateThumb } from '../../utils/resizeImage';
import { FileItemConfig } from '../FileItem/FileItemConfig';
import { fileCssBg } from '../svg-backgrounds/svg-backgrounds';
import './thumb.css';

const CDN_MAX_OUTPUT_DIMENSION = 3000;

export class Thumb extends FileItemConfig {
  private _renderedGridOnce = false;

  private _thumbRect: IntersectionObserverEntry['boundingClientRect'] | null = null;

  private _isIntersecting = false;

  private _firstViewMode = this.cfg.filesViewMode;

  private _observer?: IntersectionObserver;

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      thumbUrl: '',
      badgeIcon: '',
      uid: '',
    } as typeof this.init$ & { thumbUrl: string; badgeIcon: string; uid: string };
  }

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
  private _generateThumbnail = this._withEntry(async (entry, force: boolean = false) => {
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

  private _observerCallback(entries: IntersectionObserverEntry[]): void {
    const [entry] = entries;
    if (!entry) {
      return;
    }
    this._isIntersecting = entry.isIntersecting;

    if (entry.isIntersecting) {
      this._thumbRect = entry.boundingClientRect;
      this._debouncedGenerateThumb();
      this._observer?.disconnect();
    }

    if (entry.intersectionRatio === 0) {
      this._debouncedGenerateThumb.cancel();
    }
  }

  protected override _reset(): void {
    super._reset();
    this._debouncedGenerateThumb.cancel();
  }

  private _handleEntryId(id: string): void {
    this._reset();

    const entry = this.uploadCollection?.read(id);
    this._entry = entry;

    if (!entry) {
      return;
    }

    this._subEntry('fileInfo', (fileInfo) => {
      if (fileInfo?.isImage && this._isIntersecting) {
        this._debouncedGenerateThumb();
      }
    });

    this._subEntry('thumbUrl', (thumbUrl) => {
      this.$.thumbUrl = thumbUrl ? `url(${thumbUrl})` : '';
    });

    this._subEntry('cdnUrlModifiers', () => {
      if (this._isIntersecting) {
        this._debouncedGenerateThumb();
      }
    });

    if (this._isIntersecting) {
      this._debouncedGenerateThumb();
    }
  }

  override initCallback(): void {
    super.initCallback();

    this.defineAccessor('badgeIcon', (val: string) => {
      this.$.badgeIcon = val;
    });

    this.defineAccessor('uid', (value: string) => {
      this.set$({ uid: value });
    });

    this.sub('uid', (uid: string) => {
      this._handleEntryId(uid);
    });

    this.subConfigValue('filesViewMode', (viewMode) => {
      if (viewMode === 'grid' && !this._renderedGridOnce) {
        if (this._firstViewMode === 'list') {
          this._debouncedGenerateThumb(true);
        }
        this._renderedGridOnce = true;
      }
    });

    this.setAttribute('role', 'img');
  }

  override connectedCallback(): void {
    super.connectedCallback();

    this._observer = new window.IntersectionObserver(this._observerCallback.bind(this), { threshold: 0.1 });

    this._observer.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    this._entrySubs = new Set();
    this._debouncedGenerateThumb.cancel();
    this._observer?.disconnect();
  }
}

Thumb.template = /* html */ `
  <div class="uc-thumb" set="style.backgroundImage: thumbUrl">
    <div class="uc-badge">
      <uc-icon set="@name: badgeIcon"></uc-icon>
    </div>
  </div>
`;

Thumb.bindAttributes({
  // @ts-expect-error TODO: fix types inside symbiote
  badgeIcon: null,
  // @ts-expect-error TODO: fix types inside symbiote
  uid: null,
});
