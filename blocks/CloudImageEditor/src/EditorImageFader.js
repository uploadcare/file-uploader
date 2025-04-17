import { debounce } from '../../utils/debounce.js';
import { Block } from '../../../abstract/Block.js';
import { classNames } from './lib/classNames.js';
import { linspace } from './lib/linspace.js';
import { batchPreloadImages } from '../../utils/preloadImage.js';
import { COLOR_OPERATIONS_CONFIG } from './toolbar-constants.js';
import { viewerImageSrc } from './util.js';

/**
 * @param {Number[]} numbers
 * @returns {[Number, Number][]}
 */
function splitBySections(numbers) {
  return numbers.reduce(
    (acc, point, idx) => (idx < numbers.length - 1 ? [...acc, [point, numbers[idx + 1]]] : acc),
    [],
  );
}

/**
 * @param {Number[]} keypoints
 * @param {Number} value
 * @param {Number} zero
 */
function calculateOpacities(keypoints, value, zero) {
  let section = splitBySections(keypoints).find(([left, right]) => left <= value && value <= right);
  return keypoints.map((point) => {
    let distance = Math.abs(section[0] - section[1]);
    let relation = Math.abs(value - section[0]) / distance;

    if (section[0] === point) {
      return value > zero ? 1 : 1 - relation;
    }
    if (section[1] === point) {
      return value >= zero ? relation : 1;
    }
    return 0;
  });
}

/**
 * @param {Number[]} keypoints
 * @param {Number} zero
 */
function calculateZIndices(keypoints, zero) {
  return keypoints.map((point, idx) => (point < zero ? keypoints.length - idx : idx));
}

/**
 * @param {String} operation
 * @param {Number} value
 * @returns {Number[]}
 */
function keypointsRange(operation, value) {
  let n = COLOR_OPERATIONS_CONFIG[operation].keypointsNumber;
  let { range, zero } = COLOR_OPERATIONS_CONFIG[operation];

  return [...new Set([...linspace(range[0], zero, n + 1), ...linspace(zero, range[1], n + 1), zero, value])].sort(
    (a, b) => a - b,
  );
}

/**
 * @typedef {Object} Keypoint
 * @property {String} src
 * @property {Number} opacity
 * @property {Number} zIndex
 * @property {HTMLImageElement} image
 * @property {Number} value
 */

export class EditorImageFader extends Block {
  constructor() {
    super();

    /**
     * @private
     * @type {Boolean}
     */
    this._isActive = false;

    /**
     * @private
     * @type {Boolean}
     */
    this._hidden = true;

    /** @private */
    this._addKeypointDebounced = debounce(this._addKeypoint.bind(this), 600);

    this.classList.add('uc-inactive_to_cropper');
  }

  /**
   * @private
   * @param {String} src
   * @returns {() => void} Destructor
   */
  _handleImageLoading(src) {
    let operation = this._operation;

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

  /** @private */
  _flush() {
    window.cancelAnimationFrame(this._raf);
    this._raf = window.requestAnimationFrame(() => {
      for (let kp of this._keypoints) {
        let { image } = kp;
        if (image) {
          image.style.opacity = kp.opacity.toString();
          image.style.zIndex = kp.zIndex.toString();
        }
      }
    });
  }

  /**
   * @private
   * @param {Object} options
   * @param {String} [options.url]
   * @param {String} [options.filter]
   * @param {String} [options.operation]
   * @param {Number} [options.value]
   * @returns {Promise<String>}
   */
  async _imageSrc({ url = this._url, filter = this._filter, operation, value } = {}) {
    let transformations = { ...this._transformations };

    if (operation) {
      transformations[operation] = filter ? { name: filter, amount: value } : value;
    }

    // do not use getBoundingClientRect because scale transform affects it
    let width = this.offsetWidth;
    return await this.proxyUrl(viewerImageSrc(url, width, transformations));
  }

  /**
   * @private
   * @param {String} operation
   * @param {Number} value
   * @returns {Promise<Keypoint>}
   */
  async _constructKeypoint(operation, value) {
    let src = await this._imageSrc({ operation, value });
    return {
      src,
      image: null,
      opacity: 0,
      zIndex: 0,
      value,
    };
  }

  /**
   * Check if current operation and filter equals passed ones
   *
   * @private
   * @param {String} operation
   * @param {String} [filter]
   * @returns {Boolean}
   */
  _isSame(operation, filter) {
    return this._operation === operation && this._filter === filter;
  }

  /**
   * @private
   * @param {String} operation
   * @param {String | null} filter
   * @param {Number} value
   */
  async _addKeypoint(operation, filter, value) {
    let shouldSkip = () =>
      !this._isSame(operation, filter) || this._value !== value || !!this._keypoints.find((kp) => kp.value === value);

    if (shouldSkip()) {
      return;
    }
    let keypoint = await this._constructKeypoint(operation, value);
    let image = new Image();
    image.src = keypoint.src;
    let stop = this._handleImageLoading(keypoint.src);
    image.addEventListener('load', stop, { once: true });
    image.addEventListener('error', stop, { once: true });
    keypoint.image = image;
    image.classList.add('uc-fader-image');

    image.addEventListener(
      'load',
      () => {
        if (shouldSkip()) {
          return;
        }
        let keypoints = this._keypoints;
        let idx = keypoints.findIndex((kp) => kp.value > value);
        let insertBeforeNode = idx < keypoints.length ? keypoints[idx].image : null;
        if (!this._container || (insertBeforeNode && !this._container.contains(insertBeforeNode))) {
          return;
        }
        keypoints.splice(idx, 0, keypoint);
        this._container.insertBefore(image, insertBeforeNode);
        this._update(operation, value);
      },
      { once: true },
    );

    image.addEventListener(
      'error',
      () => {
        this.$['*networkProblems'] = true;
      },
      { once: true },
    );
  }

  /** @param {String | Number} value */
  set(value) {
    value = typeof value === 'string' ? parseInt(value, 10) : value;
    this._update(this._operation, value);
    this._addKeypointDebounced(this._operation, this._filter, value);
  }

  /**
   * @private
   * @param {String} operation
   * @param {Number} value
   */
  _update(operation, value) {
    this._operation = operation;
    this._value = value;

    let { zero } = COLOR_OPERATIONS_CONFIG[operation];

    let keypointValues = this._keypoints.map((kp) => kp.value);
    let opacities = calculateOpacities(keypointValues, value, zero);
    let zIndices = calculateZIndices(keypointValues, zero);

    for (let [idx, kp] of Object.entries(this._keypoints)) {
      kp.opacity = opacities[idx];
      kp.zIndex = zIndices[idx];
    }

    this._flush();
  }

  /** @private */
  _createPreviewImage() {
    let image = new Image();
    image.classList.add('uc-fader-image', 'uc-fader-image--preview');
    image.style.opacity = '0';
    return image;
  }

  /** @private */
  async _initNodes() {
    let fr = document.createDocumentFragment();
    this._previewImage = this._previewImage || this._createPreviewImage();
    !this.contains(this._previewImage) && fr.appendChild(this._previewImage);

    let container = document.createElement('div');
    fr.appendChild(container);

    let srcList = this._keypoints.map((kp) => kp.src);

    let { images, promise, cancel } = batchPreloadImages(srcList);
    images.forEach((node) => {
      let stop = this._handleImageLoading(node.src);
      node.addEventListener('load', stop);
      node.addEventListener('error', stop);
    });
    this._cancelLastImages = () => {
      cancel();
      this._cancelLastImages = undefined;
    };
    let operation = this._operation;
    let filter = this._filter;
    await promise;
    if (this._isActive && this._isSame(operation, filter)) {
      this._container && this._container.remove();
      this._container = container;
      this._keypoints.forEach((kp, idx) => {
        let kpImage = images[idx];
        kpImage.classList.add('uc-fader-image');
        kp.image = kpImage;
        this._container.appendChild(kpImage);
      });
      this.appendChild(fr);
      this._flush();
    }
  }

  /** @param {import('./types.js').Transformations} transformations */
  async setTransformations(transformations) {
    this._transformations = transformations;
    if (this._previewImage) {
      let src = await this._imageSrc();
      let stop = this._handleImageLoading(src);
      this._previewImage.src = src;
      this._previewImage.addEventListener('load', stop, { once: true });
      this._previewImage.addEventListener('error', stop, { once: true });
      this._previewImage.style.opacity = '1';

      this._previewImage.addEventListener(
        'error',
        () => {
          this.$['*networkProblems'] = true;
        },
        { once: true },
      );
    }
  }

  /**
   * @param {object} options
   * @param {String} options.url
   * @param {String} options.operation
   * @param {Number} options.value
   * @param {String} [options.filter]
   */
  async preload({ url, filter, operation, value }) {
    this._cancelBatchPreload && this._cancelBatchPreload();

    let keypoints = keypointsRange(operation, value);
    let srcList = await Promise.all(keypoints.map((kp) => this._imageSrc({ url, filter, operation, value: kp })));
    let { cancel } = batchPreloadImages(srcList);

    this._cancelBatchPreload = cancel;
  }

  /** @private */
  _setOriginalSrc(src) {
    let image = this._previewImage || this._createPreviewImage();
    !this.contains(image) && this.appendChild(image);
    this._previewImage = image;

    if (image.src === src) {
      image.style.opacity = '1';
      image.style.transform = 'scale(1)';

      this.className = classNames({
        'uc-active_from_viewer': this._fromViewer,
        'uc-active_from_cropper': !this._fromViewer,
        'uc-inactive_to_cropper': false,
      });
      return;
    }
    image.style.opacity = '0';
    let stop = this._handleImageLoading(src);
    image.addEventListener('error', stop, { once: true });
    image.src = src;
    image.addEventListener(
      'load',
      () => {
        stop();
        if (image) {
          image.style.opacity = '1';
          image.style.transform = 'scale(1)';

          this.className = classNames({
            'uc-active_from_viewer': this._fromViewer,
            'uc-active_from_cropper': !this._fromViewer,
            'uc-inactive_to_cropper': false,
          });
        }
      },
      { once: true },
    );
    image.addEventListener(
      'error',
      () => {
        this.$['*networkProblems'] = true;
      },
      { once: true },
    );
  }

  /**
   * @param {object} options
   * @param {String} options.url
   * @param {String} [options.operation]
   * @param {Number} [options.value]
   * @param {String} [options.filter]
   * @param {Boolean} [options.fromViewer]
   */
  async activate({ url, operation, value, filter, fromViewer }) {
    this._isActive = true;
    this._hidden = false;
    this._url = url;
    this._operation = operation || 'initial';
    this._value = value;
    this._filter = filter;
    this._fromViewer = fromViewer;

    let isOriginal = typeof value !== 'number' && !filter;
    if (isOriginal) {
      let src = await this._imageSrc({ operation, value });
      this._setOriginalSrc(src);
      this._container && this._container.remove();
      return;
    }
    this._keypoints = await Promise.all(
      keypointsRange(operation, value).map((keyValue) => this._constructKeypoint(operation, keyValue)),
    );

    this._update(operation, value);
    this._initNodes();
  }

  /** @param {{ hide?: Boolean }} options */
  deactivate({ hide = true } = {}) {
    this._isActive = false;

    this._cancelLastImages && this._cancelLastImages();
    this._cancelBatchPreload && this._cancelBatchPreload();

    if (hide && !this._hidden) {
      this._hidden = true;
      if (this._previewImage) {
        this._previewImage.style.transform = 'scale(1)';
      }

      this.className = classNames({
        'uc-active_from_viewer': false,
        'uc-active_from_cropper': false,
        'uc-inactive_to_cropper': true,
      });
      this.addEventListener(
        'transitionend',
        () => {
          this._container && this._container.remove();
        },
        { once: true },
      );
    } else {
      this._container && this._container.remove();
    }
  }
}
