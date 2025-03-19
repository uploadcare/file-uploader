//@ts-check

import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { createCdnUrl, createCdnUrlModifiers, createOriginalUrl } from '../../utils/cdn-utils.js';
import { fileCssBg } from '../svg-backgrounds/svg-backgrounds.js';
import { debounce } from '../utils/debounce.js';
import { generateThumb } from '../utils/resizeImage.js';

export class Thumb extends UploaderBlock {
  /** @private */
  _entrySubs = new Set();

  /**
   * @private
   * @type {import('../../abstract/uploadEntrySchema.js').UploadEntryTypedData | null}
   */
  _entry = null;

  /**
   * @private
   * @type {IntersectionObserverEntry['boundingClientRect'] | null}
   */
  _thumbRect = null;

  _isIntersecting = false;

  /**
   * @private
   * @template {any[]} A
   * @template {(entry: import('../../abstract/uploadEntrySchema.js').UploadEntryTypedData, ...args: A) => any} T
   * @param {T} fn
   * @returns {(...args: A) => ReturnType<T>}
   */
  _withEntry(fn) {
    const wrapperFn = /** @type {(...args: A) => ReturnType<T>} */ (
      (...args) => {
        const entry = this._entry;
        if (!entry) {
          console.warn('No entry found');
          return;
        }
        return fn(entry, ...args);
      }
    );
    return wrapperFn;
  }

  /**
   * @template {import('../../abstract/uploadEntrySchema.js').UploadEntryKeys} K
   * @param {K} prop_
   * @param {(value: import('../../abstract/uploadEntrySchema.js').UploadEntryData[K]) => void} handler_
   */
  _subEntry = (prop_, handler_) =>
    this._withEntry(
      /**
       * @template {import('../../abstract/uploadEntrySchema.js').UploadEntryKeys} K
       * @param {import('../../abstract/uploadEntrySchema.js').UploadEntryTypedData} entry
       * @param {K} prop
       * @param {(value: import('../../abstract/uploadEntrySchema.js').UploadEntryData[K]) => void} handler
       */
      (entry, prop, handler) => {
        let sub = entry.subscribe(prop, (value) => {
          if (this.isConnected) {
            handler(value);
          }
        });
        this._entrySubs.add(sub);
      },
    )(prop_, handler_);

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      thumbUrl: '',
      badgeIcon: '',
      uid: '',
    };
  }

  _calculateThumbSize() {
    let size = Math.max(
      parseInt(String(this?._thumbRect?.height || 0)),
      parseInt(String(this?._thumbRect?.width || 0)),
      this.cfg.thumbSize,
    );

    if (window.devicePixelRatio > 1) {
      size *= window.devicePixelRatio;
    }

    return size;
  }

  /** @private */
  _generateThumbnail = this._withEntry(async (entry) => {
    const fileInfo = entry.getValue('fileInfo');
    const isImage = entry.getValue('isImage');
    const uuid = entry.getValue('uuid');
    let size = this._calculateThumbSize();

    if (fileInfo && isImage && uuid) {
      let thumbUrl = await this.proxyUrl(
        createCdnUrl(
          createOriginalUrl(this.cfg.cdnCname, uuid),
          createCdnUrlModifiers(entry.getValue('cdnUrlModifiers'), `scale_crop/${size}x${size}/center`),
        ),
      );
      let currentThumbUrl = entry.getValue('thumbUrl');
      if (currentThumbUrl !== thumbUrl) {
        entry.setValue('thumbUrl', thumbUrl);
        currentThumbUrl?.startsWith('blob:') && URL.revokeObjectURL(currentThumbUrl);
      }
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

  initCallback() {
    super.initCallback();

    this.defineAccessor('badgeIcon', (/** @type {string} */ val) => (this.$.badgeIcon = val));

    this.defineAccessor('uid', (/** @type {string} */ value) => {
      this.set$({ uid: value });
    });

    this.sub('uid', (value) => {
      this._entry = this.uploadCollection.read(value);
    });

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
