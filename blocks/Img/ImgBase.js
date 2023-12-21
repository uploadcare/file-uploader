import { BaseComponent, Data } from '@symbiotejs/symbiote';
import { applyTemplateData } from '../../utils/template-utils.js';
import { createCdnUrl, createCdnUrlModifiers, createOriginalUrl } from '../../utils/cdn-utils.js';
import { PROPS_MAP } from './props-map.js';
import { stringToArray } from '../../utils/stringToArray.js';
import { uniqueArray } from '../../utils/uniqueArray.js';

const CSS_PREF = '--lr-img-';
const UNRESOLVED_ATTR = 'unresolved';
const HI_RES_K = 2;
const ULTRA_RES_K = 3;
const DEV_MODE =
  !window.location.host.trim() || window.location.host.includes(':') || window.location.hostname.includes('localhost');

const CSS_PROPS = Object.create(null);
for (let prop in PROPS_MAP) {
  CSS_PROPS[CSS_PREF + prop] = PROPS_MAP[prop]?.default || '';
}

export class ImgBase extends BaseComponent {
  cssInit$ = CSS_PROPS;

  /**
   * @param {String} key
   * @returns {any}
   */
  $$(key) {
    return this.$[CSS_PREF + key];
  }

  /** @param {Object<String, String | Number>} kvObj */
  set$$(kvObj) {
    for (let key in kvObj) {
      this.$[CSS_PREF + key] = kvObj[key];
    }
  }

  /**
   * @param {String} key
   * @param {(val: any) => void} kbFn
   */
  sub$$(key, kbFn) {
    this.sub(CSS_PREF + key, (val) => {
      // null comes from CSS context property
      // empty string comes from attribute value
      if (val === null || val === '') {
        return;
      }
      kbFn(val);
    });
  }

  /**
   * @private
   * @param {String} src
   */
  _fmtAbs(src) {
    let isRel = !src.includes('//');
    if (isRel && !DEV_MODE) {
      src = new URL(src, document.baseURI).href;
    }
    return src;
  }

  /**
   * Image operations
   *
   * @param {String} [size]
   * @param {String} [blur]
   */
  _getCdnModifiers({ size = '', blur = '' }) {
    return createCdnUrlModifiers(
      //
      size && `resize/${size}`,
      blur && `blur/${blur}`,
      this.$$('cdn-operations') || '',
      `format/${this.$$('format') || PROPS_MAP.format.default}`,
      `quality/${this.$$('quality') || PROPS_MAP.quality.default}`
    );
  }

  /**
   * @private
   * @param {String} size
   * @param {String} blur
   * @returns {any}
   */
  _getUrlBase({ size = '', blur = '' }) {
    if (this.$$('src').startsWith('data:') || this.$$('src').startsWith('blob:')) {
      return this.$$('src');
    }

    // Localhost + relative image path (DO NOTHING):
    if (DEV_MODE && this.$$('src') && !this.$$('src').includes('//')) {
      return this._proxyUrl(this.$$('src'));
    }

    let cdnModifiers = this._getCdnModifiers({ size, blur });

    if (this.$$('src').startsWith(this.$$('cdn-cname'))) {
      return createCdnUrl(this.$$('src'), cdnModifiers);
    }

    // Alternative CDN name:
    if (this.$$('cdn-cname') && this.$$('uuid')) {
      return this._proxyUrl(
        createCdnUrl(
          //
          createOriginalUrl(this.$$('cdn-cname'), this.$$('uuid')),
          cdnModifiers
        )
      );
    }

    // UUID only:
    if (this.$$('uuid')) {
      return this._proxyUrl(
        createCdnUrl(
          //
          createOriginalUrl(this.$$('cdn-cname'), this.$$('uuid')),
          cdnModifiers
        )
      );
    }

    // Alternative proxy name:
    if (this.$$('proxy-cname')) {
      return this._proxyUrl(
        createCdnUrl(
          //
          this.$$('proxy-cname'),
          cdnModifiers,
          this._fmtAbs(this.$$('src'))
        )
      );
    }

    // Project pubkey only:
    if (this.$$('pubkey')) {
      return this._proxyUrl(
        createCdnUrl(
          //
          `https://${this.$$('pubkey')}.ucr.io/`,
          cdnModifiers,
          this._fmtAbs(this.$$('src'))
        )
      );
    }
  }

  /**
   * @private
   * @param {String} url
   * @returns {String}
   */
  _proxyUrl(url) {
    let previewProxy = this.$$('secure-delivery-proxy');
    if (!previewProxy) {
      return url;
    }
    return applyTemplateData(
      this.$$('secure-delivery-proxy'),
      { previewUrl: url },
      { transform: (value) => window.encodeURIComponent(value) }
    );
  }

  /**
   * @param {HTMLElement} el
   * @param {Number} [k]
   * @param {Boolean} [wOnly]
   */
  _getElSize(el, k = 1, wOnly = true) {
    let rect = el.getBoundingClientRect();
    let w = k * Math.round(rect.width);
    let h = wOnly ? '' : k * Math.round(rect.height);
    if (w || h) {
      return `${w ? w : ''}x${h ? h : ''}`;
    } else {
      return null;
    }
  }

  /** @param {HTMLImageElement} img */
  _setupEventProxy(img) {
    /** @param {Event} e */
    let proxifyEvent = (e) => {
      e.stopPropagation();
      let event = new Event(e.type, e);
      this.dispatchEvent(event);
    };
    let EVENTS = ['load', 'error'];
    for (let event of EVENTS) {
      img.addEventListener(event, proxifyEvent);
    }
  }

  /**
   * Blurred image preview for <lr-img> during image loading
   *
   * @private
   */
  _loadImageOfPreview() {
    if (!this._hasPreviewBlur) {
      return null;
    }

    this._imageBlur = new Image();

    const resultURI = this._getUrlBase({
      size: '100x',
      blur: '100',
    });
    this._setupEventProxy(this._imageBlur);
    this.initAttributes(this._imageBlur);

    this._imageBlur.srcset = resultURI;
    this._imageBlur.src = resultURI;

    this.appendChild(this._imageBlur);
  }

  _loadImage() {
    return new Promise((resolve, reject) => {
      this._image = new Image();

      this._setupEventProxy(this._image);
      this._image.setAttribute(UNRESOLVED_ATTR, '');

      this.initAttributes(this._image);

      this._image.addEventListener('load', () => {
        this._image.removeAttribute(UNRESOLVED_ATTR);
        resolve(this._image);
      });

      this._image.addEventListener('error', () => {
        reject(new Error('Error loading image'));
      });

      this.appendChild(this._image);
    });
  }

  /** @type {HTMLImageElement} */
  get img() {
    if (!this._image) {
      this._loadImage().then(() => {
        if (this._imageBlur) {
          this._imageBlur.remove();
        }
      });
    }
    return this._image;
  }

  get _hasBgSelector() {
    return this.$$('is-background-for');
  }

  get _hasIntersection() {
    return this.$$('intersection');
  }

  get _hasBreakpoints() {
    return this.$$('breakpoints');
  }

  get _hasPreviewBlur() {
    return this.$$('is-preview-blur');
  }

  get breakpoints() {
    if (this._hasBreakpoints) {
      return uniqueArray(stringToArray(this._hasBreakpoints).map((str) => Number(str)));
    } else {
      return null;
    }
  }

  /** @param {HTMLImageElement} elNode */
  initAttributes(elNode) {
    [...this.attributes].forEach((attr) => {
      if (!PROPS_MAP[attr.name]) {
        elNode.setAttribute(attr.name, attr.value);
      }
    });
  }

  /** @param {HTMLElement} el */
  renderBg(el) {
    let imgSet = new Set();
    if (this.breakpoints) {
      this.breakpoints.forEach((bp) => {
        imgSet.add(`url("${this._getUrlBase({ size: bp + 'x' })}") ${bp}w`);
        if (this.$$('hi-res-support')) {
          imgSet.add(`url("${this._getUrlBase({ size: bp * HI_RES_K + 'x' })}") ${bp * HI_RES_K}w`);
        }
        if (this.$$('ultra-res-support')) {
          imgSet.add(`url("${this._getUrlBase({ size: bp * ULTRA_RES_K + 'x' })}") ${bp * ULTRA_RES_K}w`);
        }
      });
    } else {
      imgSet.add(
        `url("${this._getUrlBase({
          size: this._getElSize(el),
        })}") 1x`
      );
      if (this.$$('hi-res-support')) {
        imgSet.add(
          `url("${this._getUrlBase({
            size: this._getElSize(el, HI_RES_K),
          })}") ${HI_RES_K}x`
        );
      }
      if (this.$$('ultra-res-support')) {
        imgSet.add(
          `url("${this._getUrlBase({
            size: this._getElSize(el, ULTRA_RES_K),
          })}") ${ULTRA_RES_K}x`
        );
      }
    }
    let iSet = `image-set(${[...imgSet].join(', ')})`;
    el.style.setProperty('background-image', iSet);
    el.style.setProperty('background-image', '-webkit-' + iSet);
  }

  getSrcset() {
    let srcset = new Set();
    if (this.breakpoints) {
      this.breakpoints.forEach((bp) => {
        srcset.add(this._getUrlBase({ size: bp + 'x' }) + ` ${bp}w`);
        if (this.$$('hi-res-support')) {
          srcset.add(
            this._getUrlBase({
              size: bp * HI_RES_K + 'x',
            }) + ` ${bp * HI_RES_K}w`
          );
        }
        if (this.$$('ultra-res-support')) {
          srcset.add(this._getUrlBase({ size: bp * ULTRA_RES_K + 'x' }) + ` ${bp * ULTRA_RES_K}w`);
        }
      });
    } else {
      srcset.add(
        this._getUrlBase({
          size: this._getElSize(this.img),
        }) + ' 1x'
      );
      if (this.$$('hi-res-support')) {
        srcset.add(
          this._getUrlBase({
            size: this._getElSize(this.img, 2),
          }) + ' 2x'
        );
      }
      if (this.$$('ultra-res-support')) {
        srcset.add(
          this._getUrlBase({
            size: this._getElSize(this.img, 3),
          }) + ' 3x'
        );
      }
    }
    return [...srcset].join();
  }

  getSrc() {
    return this._getUrlBase({});
  }

  _setupImageSrc() {
    this.img.src = this.getSrc();
    this.img.srcset = this.getSrcset();
  }

  _renderNode() {
    if (this._hasBgSelector) {
      [...document.querySelectorAll(this._hasBgSelector)].forEach((el) => {
        if (this._hasIntersection) {
          this.initIntersection(el, () => {
            this.renderBg(el);
          });
        } else {
          this.renderBg(el);
        }
      });

      return;
    }

    this._loadImageOfPreview();

    if (this._hasIntersection) {
      this.initIntersection(this.img, () => {
        this._setupImageSrc();
      });
    } else {
      this._setupImageSrc();
    }
  }

  init() {
    this._renderNode();
  }

  /**
   * @param {HTMLElement} el
   * @param {() => void} cbkFn
   */
  initIntersection(el, cbkFn) {
    let opts = {
      root: null,
      rootMargin: '0px',
    };
    /** @private */
    this._isnObserver = new IntersectionObserver((entries) => {
      entries.forEach((ent) => {
        if (ent.isIntersecting) {
          cbkFn();
          this._isnObserver.unobserve(el);
        }
      });
    }, opts);
    this._isnObserver.observe(el);
    if (!this._observed) {
      /** @private */
      this._observed = new Set();
    }
    this._observed.add(el);
  }

  destroyCallback() {
    super.destroyCallback();
    if (this._isnObserver) {
      this._observed.forEach((el) => {
        this._isnObserver.unobserve(el);
      });
      this._isnObserver = null;
    }
    Data.deleteCtx(this);
  }

  static get observedAttributes() {
    return Object.keys(PROPS_MAP);
  }

  attributeChangedCallback(name, oldVal, newVal) {
    window.setTimeout(() => {
      this.$[CSS_PREF + name] = newVal;
    });
  }
}
