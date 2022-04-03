import { BaseComponent } from '../../submodules/symbiote/core/symbiote.js';
import { PROPS_MAP } from './props-map.js';

const CSS_PREF = '--uc-img-';
const UNRESOLVED_ATTR = 'unresolved';
const DEV_MODE =
  !window.location.host.trim() || window.location.host.includes(':') || window.location.hostname.includes('localhost');

/**
 * @param {...String} args
 * @returns {any}
 */
function join(...args) {
  return args
    .map((subStr) => {
      if (subStr?.trim() && !subStr.endsWith('/')) {
        subStr += '/';
      }
      return subStr;
    })
    .join('');
}

export class ImgBase extends BaseComponent {
  /**
   * @param {String} key
   * @returns {any}
   */
  $$(key) {
    return this.$[CSS_PREF + key];
  }

  /** @param {Object<string, string | number>} kvObj */
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
  _getOps(size = '') {
    return join(
      size ? '-/' + size : '',
      this.$$('cdn-operations') ? '-/' + this.$$('cdn-operations') : '',
      '-/format/' + this.$$('format')
    );
  }

  /**
   * @private
   * @param {String} size
   * @returns {any}
   */
  _getUrlBase(size = '') {
    // Localhost + relative image path (DO NOTHING):
    if (DEV_MODE && this.$$('src') && !this.$$('src').includes('//')) {
      return this.$$('src');
    }

    let ops = this._getOps(size);

    // Alternative CDN name:
    if (this.$$('cdn-cname') && this.$$('uuid')) {
      return join(this.$$('cdn-cname'), this.$$('uuid'), ops);
    }

    // UUID only:
    if (this.$$('uuid')) {
      return join('https://ucarecdn.com/', this.$$('uuid'), ops);
    }

    // Alternative proxy name:
    if (this.$$('proxy-cname')) {
      return join(this.$$('proxy-cname'), ops, this._fmtAbs(this.$$('src')));
    }

    // Project pubkey only:
    if (this.$$('pubkey')) {
      return join(`https://${this.$$('pubkey')}.ucr.io/`, ops, this._fmtAbs(this.$$('src')));
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

  renderBg() {
    [...document.querySelectorAll(this.bgSelector)].forEach((el) => {
      el.style.backgroundImage = `url("${this._getUrlBase()}")`;
    });
  }

  init() {
    if (this.bgSelector) {
      this.renderBg();
    } else if (this.$$('intersection')) {
      this.initIntersection(() => {
        this.img.srcset = this._getUrlBase();
      });
    } else {
      this.img.srcset = this._getUrlBase();
    }
  }

  /** @param {() => void} cbkFn */
  initIntersection(cbkFn) {
    let opts = {
      root: null,
      rootMargin: '0px',
    };
    /** @private */
    this._isnObserver = new IntersectionObserver((entries) => {
      entries.forEach((ent) => {
        if (ent.isIntersecting) {
          cbkFn();
          this._isnObserver.unobserve(this.img);
        }
      });
    }, opts);
    this._isnObserver.observe(this.img);
  }

  destroyCallback() {
    this._isnObserver.unobserve(this.img);
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
