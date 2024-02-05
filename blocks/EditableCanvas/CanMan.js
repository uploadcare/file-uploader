// Canvas Manipulator
import { applyStyles, applyAttributes } from '@symbiotejs/symbiote';
const SVGNS = 'http://www.w3.org/2000/svg';

export class CanMan {
  _syncSvgSize() {
    let rect = this.svgGroupEl.getBoundingClientRect();
    applyAttributes(this.svgEl, {
      viewBox: `0, 0, ${rect.width}, ${rect.height}`,
      width: rect.width,
      height: rect.height,
    });
  }

  _syncCanvas() {
    return new Promise((resolve, reject) => {
      let url = URL.createObjectURL(
        new Blob([this.svgEl.outerHTML], {
          type: 'image/svg+xml',
        }),
      );
      this.vImg.onload = () => {
        this.can.height = this.vImg.height;
        this.can.width = this.vImg.width;
        this.ctx.drawImage(this.vImg, 0, 0, this.vImg.width, this.vImg.height);
        resolve();
      };
      this.vImg.onerror = () => {
        reject();
      };
      this.vImg.src = url;
    });
  }

  _backSyncSvg() {
    this.svgGroupEl.style.transform = null;
    this.svgGroupEl.style.filter = null;
    applyAttributes(this.svgEl, {
      viewBox: `0, 0, ${this.can.width}, ${this.can.height}`,
      width: this.can.width,
      height: this.can.height,
    });
    applyAttributes(this.svgImgEl, {
      href: this.can.toDataURL('image/png'),
      width: this.can.width,
      height: this.can.height,
    });
    this._addedObjects.forEach((obj) => {
      obj.remove();
    });
    return new Promise((resolve, reject) => {
      this.svgImgEl.onload = () => {
        resolve();
      };
      this.svgImgEl.onerror = () => {
        reject();
      };
    });
  }

  async _syncAll() {
    this._syncSvgSize();
    await this._syncCanvas();
    await this._backSyncSvg();
  }

  /** @param {import('./EditableCanvas.js').RefMap} refMap */
  constructor(refMap) {
    /** @type {HTMLCanvasElement} */
    this.can = refMap.canvas;
    /** @type {SVGElement} */
    this.svgEl = refMap.svg;
    this.svgGroupEl = refMap.svgGroup;
    this.svgImgEl = refMap.svgImg;
    this.vImg = new Image();

    this.ctx = refMap.canvCtx;

    this.currentColor = CanMan.defaultColor;

    this._addedObjects = new Set();

    window.setTimeout(() => {
      this._backSyncSvg();
    }, 100);
  }

  applyCss(cssMap) {
    applyStyles(this.svgGroupEl, cssMap);
  }

  getImg() {
    let img = new Image();
    img.src = this.can.toDataURL('image/png');
    return new Promise((resolve, reject) => {
      img.onload = () => {
        resolve(img);
      };
      img.onerror = () => {
        reject(img);
      };
    });
  }

  rotate() {
    this.applyCss({
      'transform-origin': '0 0',
      transform: `rotate(90deg) translateY(-${this.can.height}px)`,
    });
    this._syncAll();
  }

  /** @param {'vertical' | 'horizontal'} type */
  flip(type) {
    this.applyCss({
      'transform-origin': '50% 50%',
      transform: `scale(${type === 'vertical' ? '1, -1' : '-1, 1'})`,
    });
    this._syncAll();
  }

  brightness(val) {
    this.applyCss({
      filter: `brightness(${val}%)`,
    });
  }

  contrast(val) {
    this.applyCss({
      filter: `contrast(${val}%)`,
    });
  }

  saturate(val) {
    this.applyCss({
      filter: `saturate(${val}%)`,
    });
  }

  setColor(val) {
    this.currentColor = val;
  }

  startText() {
    let onStart = (e) => {
      let text = document.createElementNS(SVGNS, 'text');
      // @ts-ignore
      applyAttributes(text, {
        fill: this.currentColor,
        x: e.offsetX,
        y: e.offsetY,
      });
      (text.textContent = 'TEXT'), this.svgGroupEl.appendChild(text);
      this._addedObjects.add(text);
      text.focus();
      this.svgEl.removeEventListener('mousedown', onStart);
    };
    this.svgEl.addEventListener('mousedown', onStart);
  }

  stopText() {
    this.bake();
  }

  startDraw() {
    this.svgEl.addEventListener('mousedown', (e) => {
      let pLine = document.createElementNS(SVGNS, 'polyline');
      // @ts-ignore
      applyAttributes(pLine, {
        fill: 'none',
        stroke: this.currentColor,
        'stroke-width': '4px',
      });
      this.svgGroupEl.appendChild(pLine);
      this._addedObjects.add(pLine);
      let points = [];
      this.svgEl.onmousemove = (e) => {
        points.push(`${e.offsetX},${e.offsetY}`);
        pLine.setAttribute('points', points.join(' '));
      };
    });
    window.addEventListener('mouseup', () => {
      this.svgEl.onmousemove = null;
      this.bake();
    });
    window.addEventListener('mouseleave', () => {
      this.svgEl.onmousemove = null;
      this.bake();
    });
  }

  /** @param {Boolean} val */
  removeMode(val) {
    if (val) {
    }
  }

  resize() {}

  crop() {}

  bake() {
    this._syncAll();
  }

  restore() {}
}

CanMan.defaultColor = '#f00';
