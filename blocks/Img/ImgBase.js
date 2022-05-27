import { BaseComponent } from '../../submodules/symbiote/core/symbiote.js';
import { createCdnUrl, createCdnUrlModifiers, createOriginalUrl } from '../../utils/cdn-utils.js';
import { PROPS_MAP } from './props-map.js';

const CSS_PREF = '--lr-img-';
const UNRESOLVED_ATTR = 'unresolved';
const HI_RES_K = 2;
const ULTRA_RES_K = 3;
const DEV_MODE =
  !window.location.host.trim() || window.location.host.includes(':') || window.location.hostname.includes('localhost');

export class ImgBase extends BaseComponent {
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
   */
  _getCdnModifiers(size = '') {
    return createCdnUrlModifiers(
      //
      size && `resize/${size}`,
      this.$$('cdn-operations'),
      `format/${this.$$('format')}`,
      `quality/${this.$$('quality')}`
    );
  }

  /**
   * @private
   * @param {String} size
   * @returns {any}
   */
  _getUrlBase(size = '') {
    // console.log(this.localCtx);

    // Localhost + relative image path (DO NOTHING):
    if (DEV_MODE && this.$$('src') && !this.$$('src').includes('//')) {
      return this.$$('src');
    }

    let cdnModifiers = this._getCdnModifiers(size);

    // Alternative CDN name:
    if (this.$$('cdn-cname') && this.$$('uuid')) {
      return createCdnUrl(
        //
        createOriginalUrl(this.$$('cdn-cname'), this.$$('uuid')),
        cdnModifiers
      );
    }

    // UUID only:
    if (this.$$('uuid')) {
      return createCdnUrl(
        //
        createOriginalUrl('https://ucarecdn.com/', this.$$('uuid')),
        cdnModifiers
      );
    }

    // Alternative proxy name:
    if (this.$$('proxy-cname')) {
      return createCdnUrl(
        //
        this.$$('proxy-cname'),
        cdnModifiers,
        this._fmtAbs(this.$$('src'))
      );
    }

    // Project pubkey only:
    if (this.$$('pubkey')) {
      return createCdnUrl(
        //
        `https://${this.$$('pubkey')}.ucr.io/`,
        cdnModifiers,
        this._fmtAbs(this.$$('src'))
      );
    }
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

  initCallback() {
    for (let propKey in PROPS_MAP) {
      let cssKey = CSS_PREF + propKey;
      this.bindCssData(cssKey, false);
      if (this.$$(propKey) === null && PROPS_MAP[propKey].hasOwnProperty('default')) {
        this.set$$({
          [propKey]: PROPS_MAP[propKey].default,
        });
      }
    }
  }

  /** @type {HTMLImageElement} */
  get img() {
    if (!this._img) {
      /** @private */
      this._img = new Image();
      this._img.setAttribute(UNRESOLVED_ATTR, '');
      this.img.onload = () => {
        this.img.removeAttribute(UNRESOLVED_ATTR);
      };
      this.initAttributes();
      this.appendChild(this._img);
    }
    return this._img;
  }

  get bgSelector() {
    return this.$$('is-background-for');
  }

  initAttributes() {
    [...this.attributes].forEach((attr) => {
      if (!PROPS_MAP[attr.name]) {
        this.img.setAttribute(attr.name, attr.value);
      }
    });
  }

  get breakpoints() {
    if (this.$$('breakpoints')) {
      let bpSet = new Set();
      this.$$('breakpoints')
        .split(',')
        .forEach((bpStr) => {
          bpSet.add(parseFloat(bpStr.trim()));
        });
      return bpSet;
    } else {
      return null;
    }
  }

  /** @param {HTMLElement} el */
  renderBg(el) {
    let imgSet = new Set();
    if (this.breakpoints) {
      this.breakpoints.forEach((bp) => {
        imgSet.add(`url("${this._getUrlBase(bp + 'x')}") ${bp}w`);
        if (this.$$('hi-res-support')) {
          imgSet.add(`url("${this._getUrlBase(bp * HI_RES_K + 'x')}") ${bp * HI_RES_K}w`);
        }
        if (this.$$('ultra-res-support')) {
          imgSet.add(`url("${this._getUrlBase(bp * ULTRA_RES_K + 'x')}") ${bp * ULTRA_RES_K}w`);
        }
      });
    } else {
      imgSet.add(`url("${this._getUrlBase(this._getElSize(el))}") 1x`);
      if (this.$$('hi-res-support')) {
        imgSet.add(`url("${this._getUrlBase(this._getElSize(el, HI_RES_K))}") ${HI_RES_K}x`);
      }
      if (this.$$('ultra-res-support')) {
        imgSet.add(`url("${this._getUrlBase(this._getElSize(el, ULTRA_RES_K))}") ${ULTRA_RES_K}x`);
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
        srcset.add(this._getUrlBase(bp + 'x') + ` ${bp}w`);
        if (this.$$('hi-res-support')) {
          srcset.add(this._getUrlBase(bp * HI_RES_K + 'x') + ` ${bp * HI_RES_K}w`);
        }
        if (this.$$('ultra-res-support')) {
          srcset.add(this._getUrlBase(bp * ULTRA_RES_K + 'x') + ` ${bp * ULTRA_RES_K}w`);
        }
      });
    } else {
      srcset.add(this._getUrlBase(this._getElSize(this.img)) + ' 1x');
      if (this.$$('hi-res-support')) {
        srcset.add(this._getUrlBase(this._getElSize(this.img, 2)) + ' 2x');
      }
      if (this.$$('ultra-res-support')) {
        srcset.add(this._getUrlBase(this._getElSize(this.img, 3)) + ' 3x');
      }
    }
    return [...srcset].join();
  }

  getSrc() {
    return this._getUrlBase();
  }

  init() {
    if (this.bgSelector) {
      [...document.querySelectorAll(this.bgSelector)].forEach((el) => {
        if (this.$$('intersection')) {
          this.initIntersection(el, () => {
            this.renderBg(el);
          });
        } else {
          this.renderBg(el);
        }
      });
    } else if (this.$$('intersection')) {
      this.initIntersection(this.img, () => {
        this.img.srcset = this.getSrcset();
        this.img.src = this.getSrc();
      });
    } else {
      this.img.srcset = this.getSrcset();
      this.img.src = this.getSrc();
    }
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
    if (this._isnObserver) {
      this._observed.forEach((el) => {
        this._isnObserver.unobserve(el);
      });
      this._isnObserver = null;
    }
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
