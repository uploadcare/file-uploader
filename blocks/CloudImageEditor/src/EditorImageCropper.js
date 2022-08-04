import { Block } from '../../../abstract/Block.js';
import { constraintRect, minRectSize } from './crop-utils.js';
import { CROP_PADDING, MIN_CROP_SIZE } from './cropper-constants.js';
import { classNames } from './lib/classNames.js';
import { debounce } from './lib/debounce.js';
import { pick } from './lib/pick.js';
import { preloadImage } from './lib/preloadImage.js';
import { ResizeObserver } from './lib/ResizeObserver.js';
import { viewerImageSrc } from './util.js';

/**
 * @typedef {Object} Operations
 * @property {boolean} flip
 * @property {boolean} mirror
 * @property {Number} rotate
 */

/**
 * @param {Number} value
 * @param {Number} min
 * @param {Number} max
 * @returns {Number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * @param {import('./types.js').ImageSize} imageSize
 * @param {Number} angle
 * @returns {import('./types.js').ImageSize}
 */
function rotateSize({ width, height }, angle) {
  let swap = (angle / 90) % 2 !== 0;
  return { width: swap ? height : width, height: swap ? width : height };
}

/**
 * @param {import('./types.js').Transformations['crop']} crop
 * @returns {boolean}
 */
function validateCrop(crop) {
  if (!crop) {
    return true;
  }
  /** @type {((arg: typeof crop) => boolean)[]} */
  let shouldMatch = [
    ({ dimensions, coords }) =>
      [...dimensions, ...coords].every((number) => Number.isInteger(number) && Number.isFinite(number)),
    ({ dimensions, coords }) => dimensions.every((d) => d > 0) && coords.every((c) => c >= 0),
  ];
  return shouldMatch.every((matcher) => matcher(crop));
}

export class EditorImageCropper extends Block {
  init$ = {
    ...this.init$,
    image: null,
    '*padding': CROP_PADDING,
    /** @type {Operations} */
    '*operations': {
      rotate: 0,
      mirror: false,
      flip: false,
    },
    /** @type {import('./types.js').Rectangle} */
    '*imageBox': {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    },
    /** @type {import('./types.js').Rectangle} */
    '*cropBox': {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    },
  };

  constructor() {
    super();

    /** @private */
    this._commitDebounced = debounce(this._commit.bind(this), 300);

    /** @private */
    this._handleResizeDebounced = debounce(this._handleResize.bind(this), 10);
  }

  /** @private */
  _handleResize() {
    this._initCanvas();
    this._alignImage();
    this._alignCrop();
    this._draw();
  }

  /** @private */
  _syncTransformations() {
    let transformations = this.$['*editorTransformations'];
    let pickedTransformations = pick(transformations, Object.keys(this.$['*operations']));
    let operations = { ...this.$['*operations'], ...pickedTransformations };
    this.$['*operations'] = operations;
  }

  /** @private */
  _initCanvas() {
    /** @type {HTMLCanvasElement} */
    let canvas = this.ref['canvas-el'];
    let ctx = canvas.getContext('2d');

    let width = this.offsetWidth;
    let height = this.offsetHeight;
    let dpr = window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    this._canvas = canvas;
    this._ctx = ctx;
  }

  /** @private */
  _alignImage() {
    if (!this._isActive || !this.$.image) {
      return;
    }

    let image = this.$.image;
    let padding = this.$['*padding'];
    let operations = this.$['*operations'];
    let { rotate } = operations;

    let bounds = { width: this.offsetWidth, height: this.offsetHeight };
    let naturalSize = rotateSize({ width: image.naturalWidth, height: image.naturalHeight }, rotate);

    if (naturalSize.width > bounds.width - padding * 2 || naturalSize.height > bounds.height - padding * 2) {
      let imageAspectRatio = naturalSize.width / naturalSize.height;
      let viewportAspectRatio = bounds.width / bounds.height;

      if (imageAspectRatio > viewportAspectRatio) {
        let width = bounds.width - padding * 2;
        let height = width / imageAspectRatio;
        let x = 0 + padding;
        let y = padding + (bounds.height - padding * 2) / 2 - height / 2;
        this.$['*imageBox'] = { x, y, width, height };
      } else {
        let height = bounds.height - padding * 2;
        let width = height * imageAspectRatio;
        let x = padding + (bounds.width - padding * 2) / 2 - width / 2;
        let y = 0 + padding;
        this.$['*imageBox'] = { x, y, width, height };
      }
    } else {
      let { width, height } = naturalSize;
      let x = padding + (bounds.width - padding * 2) / 2 - width / 2;
      let y = padding + (bounds.height - padding * 2) / 2 - height / 2;
      this.$['*imageBox'] = { x, y, width, height };
    }
  }

  /** @private */
  _alignCrop() {
    let cropBox = this.$['*cropBox'];
    let imageBox = this.$['*imageBox'];
    let operations = this.$['*operations'];
    let { rotate } = operations;
    let transformation = this.$['*editorTransformations']['crop'];

    if (transformation) {
      let {
        dimensions: [width, height],
        coords: [x, y],
      } = transformation;
      let { width: previewWidth, x: previewX, y: previewY } = this.$['*imageBox'];
      let { width: sourceWidth } = rotateSize(this._imageSize, rotate);
      let ratio = previewWidth / sourceWidth;
      cropBox = {
        x: previewX + x * ratio,
        y: previewY + y * ratio,
        width: width * ratio,
        height: height * ratio,
      };
    } else {
      cropBox = {
        x: imageBox.x,
        y: imageBox.y,
        width: imageBox.width,
        height: imageBox.height,
      };
    }
    /** @type {[Number, Number]} */
    let minCropRect = [Math.min(imageBox.width, MIN_CROP_SIZE), Math.min(imageBox.height, MIN_CROP_SIZE)];
    cropBox = minRectSize(cropBox, minCropRect, 'se');
    cropBox = constraintRect(cropBox, imageBox);

    this.$['*cropBox'] = cropBox;
  }

  /** @private */
  _drawImage() {
    let image = this.$.image;
    let imageBox = this.$['*imageBox'];
    let operations = this.$['*operations'];
    let { mirror, flip, rotate } = operations;
    let ctx = this._ctx;
    let rotated = rotateSize({ width: imageBox.width, height: imageBox.height }, rotate);
    ctx.save();
    ctx.translate(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
    ctx.rotate((rotate * Math.PI * -1) / 180);
    ctx.scale(mirror ? -1 : 1, flip ? -1 : 1);
    ctx.drawImage(image, -rotated.width / 2, -rotated.height / 2, rotated.width, rotated.height);
    ctx.restore();
  }

  /** @private */
  _draw() {
    if (!this._isActive || !this.$.image) {
      return;
    }
    let canvas = this._canvas;
    let ctx = this._ctx;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this._drawImage();
  }

  /** @private */
  _animateIn({ fromViewer }) {
    if (this.$.image) {
      this.ref['frame-el'].toggleThumbs(true);
      this._transitionToImage();
      setTimeout(() => {
        this.className = classNames({
          active_from_viewer: fromViewer,
          active_from_editor: !fromViewer,
          inactive_to_editor: false,
        });
      });
    }
  }

  /**
   * @private
   * @returns {import('./types.js').Transformations['crop']['dimensions']}
   */
  _calculateDimensions() {
    let cropBox = this.$['*cropBox'];
    let imageBox = this.$['*imageBox'];
    let operations = this.$['*operations'];
    let { rotate } = operations;
    let { width: previewWidth, height: previewHeight } = imageBox;
    let { width: sourceWidth, height: sourceHeight } = rotateSize(this._imageSize, rotate);
    let { width: cropWidth, height: cropHeight } = cropBox;
    let ratioW = previewWidth / sourceWidth;
    let ratioH = previewHeight / sourceHeight;

    /** @type {[Number, Number]} */
    let dimensions = [
      clamp(Math.round(cropWidth / ratioW), 1, sourceWidth),
      clamp(Math.round(cropHeight / ratioH), 1, sourceHeight),
    ];

    return dimensions;
  }

  /**
   * @private
   * @returns {import('./types.js').Transformations['crop']}
   */
  _calculateCrop() {
    let cropBox = this.$['*cropBox'];
    let imageBox = this.$['*imageBox'];
    let operations = this.$['*operations'];
    let { rotate } = operations;
    let { width: previewWidth, height: previewHeight, x: previewX, y: previewY } = imageBox;
    let { width: sourceWidth, height: sourceHeight } = rotateSize(this._imageSize, rotate);
    let { x: cropX, y: cropY } = cropBox;
    let ratioW = previewWidth / sourceWidth;
    let ratioH = previewHeight / sourceHeight;

    let dimensions = this._calculateDimensions();
    let crop = {
      dimensions,
      coords: /** @type {[Number, Number]} */ ([
        clamp(Math.round((cropX - previewX) / ratioW), 0, sourceWidth - dimensions[0]),
        clamp(Math.round((cropY - previewY) / ratioH), 0, sourceHeight - dimensions[1]),
      ]),
    };
    if (!validateCrop(crop)) {
      console.error('Cropper is trying to create invalid crop object', {
        payload: crop,
      });
      return undefined;
    }
    if (dimensions[0] === sourceWidth && dimensions[1] === sourceHeight) {
      return undefined;
    }

    return crop;
  }

  /** @private */
  _commit() {
    let operations = this.$['*operations'];
    let { rotate, mirror, flip } = operations;
    let crop = this._calculateCrop();
    /** @type {import('./types.js').Transformations} */
    let editorTransformations = this.$['*editorTransformations'];
    let transformations = {
      ...editorTransformations,
      crop,
      rotate,
      mirror,
      flip,
    };

    this.$['*editorTransformations'] = transformations;
  }

  /**
   * @param {String} operation
   * @param {Number} value
   * @returns {void}
   */
  setValue(operation, value) {
    console.log(`Apply cropper operation [${operation}=${value}]`);
    this.$['*operations'] = {
      ...this.$['*operations'],
      [operation]: value,
    };

    if (!this._isActive) {
      return;
    }

    this._alignImage();
    this._alignCrop();
    this._draw();
  }

  /**
   * @param {keyof Operations} operation
   * @returns {Number | boolean}
   */
  getValue(operation) {
    return this.$['*operations'][operation];
  }

  /**
   * @param {import('./types.js').ImageSize} imageSize
   * @param {{ fromViewer?: boolean }} options
   */
  async activate(imageSize, { fromViewer }) {
    if (this._isActive) {
      return;
    }
    this._isActive = true;
    this._imageSize = imageSize;
    this.removeEventListener('transitionend', this._reset);
    this._initCanvas();

    try {
      this.$.image = await this._waitForImage(this.$['*originalUrl'], this.$['*editorTransformations']);
      this._syncTransformations();
      this._alignImage();
      this._alignCrop();
      this._draw();
      this._animateIn({ fromViewer });
    } catch (err) {
      console.error('Failed to activate cropper', { error: err });
    }
  }
  deactivate() {
    if (!this._isActive) {
      return;
    }
    this._commit();
    this._isActive = false;

    this._transitionToCrop();

    this.className = classNames({
      active_from_viewer: false,
      active_from_editor: false,
      inactive_to_editor: true,
    });

    this.ref['frame-el'].toggleThumbs(false);
    this.addEventListener('transitionend', this._reset, { once: true });
  }

  /** @private */
  _transitionToCrop() {
    let dimensions = this._calculateDimensions();
    let scaleX = Math.min(this.offsetWidth, dimensions[0]) / this.$['*cropBox'].width;
    let scaleY = Math.min(this.offsetHeight, dimensions[1]) / this.$['*cropBox'].height;
    let scale = Math.min(scaleX, scaleY);
    let cropCenterX = this.$['*cropBox'].x + this.$['*cropBox'].width / 2;
    let cropCenterY = this.$['*cropBox'].y + this.$['*cropBox'].height / 2;

    this.style.transform = `scale(${scale}) translate(${(this.offsetWidth / 2 - cropCenterX) / scale}px, ${
      (this.offsetHeight / 2 - cropCenterY) / scale
    }px)`;
    this.style.transformOrigin = `${cropCenterX}px ${cropCenterY}px`;
  }

  /** @private */
  _transitionToImage() {
    let cropCenterX = this.$['*cropBox'].x + this.$['*cropBox'].width / 2;
    let cropCenterY = this.$['*cropBox'].y + this.$['*cropBox'].height / 2;

    this.style.transform = `scale(1)`;
    this.style.transformOrigin = `${cropCenterX}px ${cropCenterY}px`;
  }

  /** @private */
  _reset() {
    if (this._isActive) {
      return;
    }
    this.$.image = null;
  }

  /**
   * @private
   * @param {String} originalUrl
   * @param {import('./types.js').Transformations} transformations
   * @returns {Promise<HTMLImageElement>}
   */
  _waitForImage(originalUrl, transformations) {
    let width = this.offsetWidth;
    transformations = {
      ...transformations,
      crop: undefined,
      rotate: undefined,
      flip: undefined,
      mirror: undefined,
    };
    let src = this.proxyUrl(viewerImageSrc(originalUrl, width, transformations));
    let { promise, cancel, image } = preloadImage(src);

    let stop = this._handleImageLoading(src);
    image.addEventListener('load', stop, { once: true });
    image.addEventListener('error', stop, { once: true });
    this._cancelPreload && this._cancelPreload();
    this._cancelPreload = cancel;

    return promise
      .then(() => image)
      .catch((err) => {
        console.error('Failed to load image', { error: err });
        this.$['*networkProblems'] = true;
        return Promise.resolve(image);
      });
  }

  /**
   * @private
   * @param {String} src
   * @returns {() => void} Destructor
   */
  _handleImageLoading(src) {
    let operation = 'crop';
    let loadingOperations = this.$['*loadingOperations'];
    if (!loadingOperations.get(operation)) {
      loadingOperations.set(operation, new Map());
    }

    if (!loadingOperations.get(operation).get(src)) {
      loadingOperations.set(operation, loadingOperations.get(operation).set(src, true));
      this.$['*loadingOperations'] = loadingOperations;
    }

    return () => {
      if (loadingOperations?.get(operation)?.has(src)) {
        loadingOperations.get(operation).delete(src);
        this.$['*loadingOperations'] = loadingOperations;
      }
    };
  }

  initCallback() {
    super.initCallback();

    this._observer = new ResizeObserver(() => {
      if (this._isActive && this.$.image) {
        this._handleResizeDebounced();
      }
    });
    this._observer.observe(this);

    this.sub('*imageBox', () => {
      this._draw();
    });

    this.sub('*cropBox', (cropBox) => {
      if (this.$.image) {
        this._commitDebounced();
      }
    });

    setTimeout(() => {
      this.sub('*networkProblems', (networkProblems) => {
        if (!networkProblems) {
          this._isActive && this.activate(this._imageSize, { fromViewer: false });
        }
      });
    }, 0);
  }

  destroyCallback() {
    super.destroyCallback();
    this._observer?.disconnect();
  }
}

EditorImageCropper.template = /*html*/ `
  <canvas class='canvas' ref='canvas-el'></canvas>
  <lr-crop-frame ref='frame-el'></lr-crop-frame>
`;
