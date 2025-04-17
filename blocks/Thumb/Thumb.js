//@ts-check

import { createCdnUrl, createCdnUrlModifiers, createOriginalUrl } from '../../utils/cdn-utils.js';
import { preloadImage } from '../utils/preloadImage.js';
import { FileItemConfig } from '../FileItem/FileItemConfig.js';
import { fileCssBg } from '../svg-backgrounds/svg-backgrounds.js';
import { debounce } from '../utils/debounce.js';
import { generateThumb } from '../utils/resizeImage.js';

const CDN_MAX_OUTPUT_DIMENSION = 3000;
export class Thumb extends FileItemConfig {
  /** @private */
  _renderedGridOnce = false;

  /**
   * @private
   * @type {IntersectionObserverEntry['boundingClientRect'] | null}
   */
  _thumbRect = null;

  _isIntersecting = false;

  _firstViewMode = this.cfg.filesViewMode;

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      thumbUrl: '',
      badgeIcon: '',
      uid: '',
    };
  }

  _calculateThumbSize(force = false) {
    if (force) {
      this._thumbRect = this.getBoundingClientRect();
    }

    let size = Math.max(
      parseInt(String(this?._thumbRect?.height || 0)),
      parseInt(String(this?._thumbRect?.width || 0)),
      this.cfg.thumbSize,
    );

    if (window.devicePixelRatio > 1) {
      size *= window.devicePixelRatio;
    }

    return Math.min(size, CDN_MAX_OUTPUT_DIMENSION);
  }

  /** @private */
  _generateThumbnail = this._withEntry(async (entry, force = false) => {
    const fileInfo = entry.getValue('fileInfo');
    const isImage = entry.getValue('isImage');
    const uuid = entry.getValue('uuid');
    const currentThumbUrl = entry.getValue('thumbUrl');

    let size = this._calculateThumbSize(force);

    if (fileInfo && isImage && uuid) {
      let thumbUrl = await this.proxyUrl(
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
        let thumbUrl = await generateThumb(file, size);
        entry.setValue('thumbUrl', thumbUrl);
      } catch (err) {
        let color = window.getComputedStyle(this).getPropertyValue('--uc-muted-foreground');
        entry.setValue('thumbUrl', fileCssBg(color));
      }
    } else {
      let color = window.getComputedStyle(this).getPropertyValue('--uc-muted-foreground');
      entry.setValue('thumbUrl', fileCssBg(color));
    }
  });

  _debouncedGenerateThumb = debounce(this._generateThumbnail.bind(this), 100);

  /**
   * @private
   * @param {IntersectionObserverEntry[]} entries
   */
  _observerCallback(entries) {
    const [entry] = entries;
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

  _reset() {
    super._reset();
    this._debouncedGenerateThumb.cancel();
  }

  /**
   * @private
   * @param {String} id
   */
  _handleEntryId(id) {
    this._reset();

    let entry = this.uploadCollection?.read(id);
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

  initCallback() {
    super.initCallback();

    this.defineAccessor('badgeIcon', (/** @type {string} */ val) => (this.$.badgeIcon = val));

    this.defineAccessor('uid', (/** @type {string} */ value) => {
      this.set$({ uid: value });
    });

    this.sub('uid', (uid) => {
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

  connectedCallback() {
    super.connectedCallback();

    this._observer = new window.IntersectionObserver(this._observerCallback.bind(this), { threshold: 0.1 });

    this._observer.observe(this);
  }

  disconnectedCallback() {
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
