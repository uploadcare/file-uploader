import { registerSw } from '../sw-manager/sw-manager.js';
import { State } from '../symbiote/core/State.js';

window.onload = () => {
  document.execCommand("Stop", false);
  window.stop();
}


export class ImageElement extends HTMLElement {

  constructor() {
    super();
    this.img = new Image();
    let selfScript = document.querySelector('script[ctx-name]');
  }

  _getSrcset(src, width) {
    let srcArr = [];
    srcArr.push(src + `?-/resize/${width}x/ 1x`);
    srcArr.push(src + `?-/resize/${width * 2}x/ 2x`);
    return srcArr.join();
  }

  _replace() {
    [...this.attributes].forEach((attr) => {
      if (!ImageElement.observedAttributes.includes(attr.name)) {
        this.img.setAttribute(attr.name, this.getAttribute(attr.name));
      }
    });
    this.parentNode.insertBefore(this.img, this);
    this.remove();
    this.resizeObserver = new ResizeObserver((entries) => {
      // console.log(entries[0].contentRect.width);
      if (this.resizeTimout) {
        window.clearTimeout(this.resizeTimout);
      }
      this.resizeTimout = window.setTimeout(() => {
        this.img.srcset = this._getSrcset(this.src, entries[0].contentRect.width);
      }, 200);
    });
    this.resizeObserver.observe(this.img);
  }

  _wrap() {
    this._innerImages.forEach((img) => {
      img.remove();
      let src = img.src;
      let clearHeight = false;
      // img.src = '';

      if (!img.height) {
        img.height = 1;
        clearHeight = true; 
      }

      img.removeAttribute('src');
      let rect = img.getBoundingClientRect();
      if (clearHeight) {
        img.removeAttribute('height');
      }
      img.srcset = this._getSrcset(src, rect.width);
      this.appendChild(img);
    });
  }

  connectedCallback() {
    this._noscript = this.querySelector('noscript');
    if (this._noscript?.innerHTML) {
      this.innerHTML = this._noscript.innerHTML;
    }
    this._innerImages = [...this.querySelectorAll('img')];
    if (this._innerImages.length) {
      this._wrap();
    } else {
      this._innerImages = null;
      this._replace();
    }
    if (this.hasAttribute('use-proxy')) {

    }
  }

  set src(val) {
    this._src = val;
    // this.img.src = val;
  }

  get src() {
    return this._src;
  }

  attributeChangedCallback(name, oldVal, newVal) {
    let handlers = {
      src: () => {
        this.src = newVal;
      },
      uuid: () => {},
    };
    handlers[name]?.();
  }

  static get observedAttributes() {
    return [
      'uuid',
      'src',
      'format',
      'quality',
      'w-step',
      'use-proxy',
      'use-worker',
    ];
  }
  
}
