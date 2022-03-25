import { BaseComponent } from '../../submodules/symbiote/core/symbiote.js';
import { CSS_PROPS_MAP } from './css-props-map.js';
import { ATTR_MAP } from './attr-map.js';

export class UCImg extends BaseComponent {
  /**
   * @private
   * @returns {String}
   */
  __getHost() {
    let host;
    /** @type {String} */
    let cname = this.$['--uc-img-cdn-base'];
    if (cname) {
      if (!cname.endsWith('/')) {
        cname += '/';
      }
      host = cname;
    } else if (this.$['--uc-img-uuid']) {
      host = `https://ucarecdn.com/${this.$['--uc-img-uuid']}/`;
    } else {
      host = `https://${this.$['--uc-img-pubkey']}.ucr.io/`;
    }
    return host;
  }

  /** @private */
  __getTransforms() {
    let transforms = '';
    if (this.$['--uc-img-use-webp']) {
      transforms += '-/format/webp/';
    } else {
      transforms += '-/format/auto/';
    }
    if (this.$['--uc-img-cdn-transform']) {
      let fStr = this.$['--uc-img-cdn-transform'];
      if (!fStr.endsWith('/')) {
        fStr += '/';
      }
      if (!fStr.startsWith('-/')) {
        if (fStr.startsWith('/')) {
          fStr = '-' + fStr;
        } else {
          fStr = '-/' + fStr;
        }
      }
      transforms += fStr;
    }
    return transforms;
  }

  /**
   * @private
   * @param {String} imgInitUrl
   */
  __getSrcBase(imgInitUrl) {
    let srcBase;
    if (this.$['--uc-img-uuid']) {
      srcBase = `https://ucarecdn.com/${this.$['--uc-img-uuid']}/${this.__getTransforms()}`;
    } else {
      if (!imgInitUrl.includes('//')) {
        imgInitUrl = new URL(imgInitUrl, document.baseURI).href;
      }
      srcBase = this.__getHost() + this.__getTransforms() + imgInitUrl;
    }
    return srcBase;
  }

  /**
   * @private
   * @param {String} imgBaseSrc
   */
  __getSrcset(imgBaseSrc) {
    return imgBaseSrc;
  }

  /**
   * @private
   * @param {String} initImgSrc
   */
  __checkDevMode(initImgSrc) {
    let isDM = false;
    let isRelative = initImgSrc && !initImgSrc.includes('//');
    if (isRelative && this.$['--uc-img-dev-mode']) {
      isDM = true;
    }
    if (isRelative && !window.location.host.trim()) {
      isDM = true;
    }
    if (isRelative && (window.location.host.includes(':') || window.location.hostname.includes('localhost'))) {
      isDM = true;
    }
    return isDM;
  }

  /**
   * @private
   * @param {String} propName
   * @param {(val: any) => void} cbFn
   */
  __subCssProp(propName, cbFn) {
    this.sub(propName, (val) => {
      if (!val) {
        return;
      }
      cbFn();
    });
  }

  /** @private */
  __onImgLoad() {
    this.ref.img.removeAttribute('unresolved');
  }

  /** @private */
  __handleImgSrc() {
    this.ref.img.setAttribute('unresolved', '');
    let init = () => {
      let src = this.$['--uc-img-src']?.trim();

      this.ref.img.addEventListener('load', (e) => {
        this.__onImgLoad();
      });
      if (this.__checkDevMode(src)) {
        this.ref.img.src = src;
      } else {
        this.ref.img.srcset = this.__getSrcBase(src);
      }
    };

    this.__subCssProp('--uc-img-uuid', init);
    if (this.hasAttribute('uuid')) {
      this.$['--uc-img-uuid'] = this.getAttribute('uuid');
    }

    this.__subCssProp('--uc-img-src', init);
    if (this.hasAttribute('src')) {
      this.$['--uc-img-src'] = this.getAttribute('src');
    }
  }

  /** @private */
  __handleImgProps() {
    this.__subCssProp('--uc-img-alt-text', (altTxt) => {
      this.ref.img.alt = altTxt;
    });
    this.__subCssProp('--uc-img-class', (cls) => {
      this.ref.img.class = cls;
    });
  }

  /**
   * @private
   * @param {HTMLElement} el
   */
  __getSize(el) {
    let rect = el.getBoundingClientRect();
    return {
      h: rect.height,
      w: rect.width,
    };
  }

  /**
   * @private
   * @param {HTMLElement} el
   */
  __getCssBg(el) {
    let cssBgStart = 'url("' + this.__getSrcset(this.getAttribute('src')) + '")';
    return cssBgStart;
  }

  /** @private */
  __handleBg() {
    if (this.hasAttribute('is-background-for')) {
      this.$['--uc-img-is-background-for'] = this.getAttribute('is-background-for');
    }
    let elements = [...document.querySelectorAll(this.$['--uc-img-is-background-for'])];
    elements.forEach((/** @type {HTMLElement} */ el) => {
      console.log(this.__getCssBg(el));
      el.style.backgroundImage = this.__getCssBg(el);
    });
  }

  initCallback() {
    for (let propKey in CSS_PROPS_MAP) {
      this.bindCssData(propKey, false);
    }
    if (this.$['--uc-img-is-background-for'] || this.hasAttribute('is-background-for')) {
      this.style.display = 'none';
      this.__handleBg();
    } else {
      this.render(/*html*/ `<img unresolved ref="img"/>`);
      [...this.attributes].forEach((attr) => {
        if (!ATTR_MAP[attr.name]) {
          this.ref.img.setAttribute(attr.name, attr.value);
        }
      });
      this.__handleImgSrc();
      this.__handleImgProps();
    }
  }
}

UCImg.reg('uc-img');
