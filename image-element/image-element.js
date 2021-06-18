export class ImageElement extends HTMLElement {
  constructor() {
    super();
    this.img = new Image();
  }
  getSrcset(width) {
    let srcArr = [];
    srcArr.push(this.src + `?-/resize/${width}x/ 1x`);
    srcArr.push(this.src + `?-/resize/${width * 2}x/ 2x`);
    return srcArr.join();
  }
  connectedCallback() {
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
        this.img.srcset = this.getSrcset(entries[0].contentRect.width);
      }, 200);
    });
    this.resizeObserver.observe(this.img);
  }
  set src(val) {
    this._src = val;
    this.img.src = val;
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
    return ['uuid', 'src', 'format', 'quality', 'w-step'];
  }
}
