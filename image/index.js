import { BaseComponent } from '@symbiotejs/symbiote';
import { CSS_PROPS_MAP } from './css-props-map.js';
import { ATTR_MAP } from './attr-map.js';

export class UCImg extends BaseComponent {
  constructor() {
    super();
    this.style.display = 'contents';
  }

  init$ = {
    updTrigger: {},
  };

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
    if (isRelative && (window.location.host.includes(':') || window.location.hostname.includes('localhost'))) {
      isDM = true;
    }
    return isDM;
  }

  __iniImg() {
    let init = () => {
      let src = this.$['--uc-img-src']?.trim();

      if (this.__checkDevMode(src)) {
        this.ref.img.src = src;
      } else {
        this.ref.img.srcset = this.__getSrcBase(src);
      }
    };

    if (this.hasAttribute('uuid')) {
      this.sub('--uc-img-uuid', (uuid) => {
        if (!uuid) {
          return;
        }
        init();
      });
      this.$['--uc-img-uuid'] = this.getAttribute('uuid');
    }

    if (this.hasAttribute('src')) {
      this.sub('--uc-img-src', (src) => {
        if (!src) {
          return;
        }
        init();
      });
      this.$['--uc-img-src'] = this.getAttribute('src');
    }
  }

  initCallback() {
    for (let propKey in CSS_PROPS_MAP) {
      this.bindCssData(propKey, false);
    }
    [...this.attributes].forEach((attr) => {
      if (!ATTR_MAP[attr.name]) {
        this.ref.img.setAttribute(attr.name, attr.value);
      }
    });

    this.__iniImg();
  }
}

UCImg.template = /*html*/ `<img ref="img"/>`;
UCImg.reg('uc-img');
