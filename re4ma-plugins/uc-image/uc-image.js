export class UcReImg extends HTMLElement {

  constructor() {
    super();
    UcReImg.instances.add(this);
    this.src = null;
    this.pubkey = null;
    this.sizeset = null;
    this.step = null;
    this.lazy = null;
    this.proxy = null;
    this.h = null;
    this.w = null;
  }

  /**
   * 
   * @returns {String}
   */
  _getSrcset() {
    return '';
  }

  connectedCallback() {
    if (this.src) {
      console.log(this.src);
      this.img = document.createElement('img');
      if (this.lazy || this.lazy === '') {
        this.img.loading = 'lazy';
      }
      this.img.src = this.src;
      this.img.srcset = this._getSrcset();
      if (this.w) {
        this.img.setAttribute('width', this.w);
      }
      if (this.h) {
        this.img.setAttribute('height', this.h);
      }
      this.outerHTML = this.img.outerHTML;
    }
  }

  /**
   * 
   * @param {String} name 
   * @param {String} oldVal 
   * @param {String} newVal 
   */
  attributeChangedCallback(name, oldVal, newVal) {
    if (newVal === oldVal) {
      return;
    }
    this[name] = newVal;
  }

}

UcReImg.observedAttributes = [
  'src', 
  'alt',
  'sizeset',
  'step',
  'pubkey',
  'lazy',
  'proxy',
  'h',
  'w',
];
UcReImg.srcList = new Set();
UcReImg.instances = new Set();

window.customElements.define('re-img', UcReImg);