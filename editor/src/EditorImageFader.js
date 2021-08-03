import { AppComponent } from './AppComponent.js'
import { debounce } from './lib/debounce.js'
import { linspace } from './lib/linspace.js'
import { batchPreloadImages } from './lib/preloadImage.js'
import { COLOR_OPERATIONS_CONFIG } from './toolbar-constants.js'
import { viewerImageSrc } from './viewer_util.js'
import { classNames } from './lib/classNames.js'

/**
 * @param {number[]} numbers
 * @returns {[number, number][]}
 */
function splitBySections(numbers) {
  return numbers.reduce(
    (acc, point, idx) =>
      idx < numbers.length - 1 ? [...acc, [point, numbers[idx + 1]]] : acc,
    [],
  )
}

/**
 * @param {number[]} keypoints
 * @param {number} value
 * @param {number} zero
 */
function calculateOpacities(keypoints, value, zero) {
  let section = splitBySections(keypoints).find(
    ([left, right]) => left <= value && value <= right,
  )
  return keypoints.map((point) => {
    let distance = Math.abs(section[0] - section[1])
    let relation = Math.abs(value - section[0]) / distance

    if (section[0] === point) {
      return value > zero ? 1 : 1 - relation
    }
    if (section[1] === point) {
      return value >= zero ? relation : 1
    }
    return 0
  })
}

/**
 * @param {number[]} keypoints
 * @param {number} zero
 */
function calculateZIndices(keypoints, zero) {
  return keypoints.map((point, idx) =>
    point < zero ? keypoints.length - idx : idx,
  )
}

/**
 * @param {string} operation
 * @param {number} value
 * @returns {number[]}
 */
function keypointsRange(operation, value) {
  let n = COLOR_OPERATIONS_CONFIG[operation].keypointsNumber
  let { range, zero } = COLOR_OPERATIONS_CONFIG[operation]

  return [
    ...new Set([
      ...linspace(range[0], zero, n + 1),
      ...linspace(zero, range[1], n + 1),
      zero,
      value,
    ]),
  ].sort((a, b) => a - b)
}

/**
 * @typedef {Object} Keypoint
 * @property {string} src
 * @property {number} opacity
 * @property {number} zIndex
 * @property {HTMLImageElement} image
 * @property {number} value
 */

export class EditorImageFader extends AppComponent {
  constructor() {
    super()

    this._isActive = false
    this._hidden = true

    this.state = {
      loadingMap: {},
    }

    this._addKeypointDebounced = debounce(this._addKeypoint.bind(this), 600)

    this.classList.add('inactive_to_cropper')
  }

  _handleImageLoading(src) {
    let operation = this._operation

    if (!this.state.loadingMap[operation]) {
      this.state.loadingMap[operation] = {}
    }

    this.state.loadingMap = {
      ...this.state.loadingMap,
      [operation]: {
        ...this.state.loadingMap[operation],
        [src]: true,
      },
    }

    return () => {
      delete this.state.loadingMap[operation][src]
      this.state.loadingMap = { ...this.state.loadingMap }
    }
  }

  _flush() {
    window.cancelAnimationFrame(this._raf)
    this._raf = window.requestAnimationFrame(() => {
      for (let kp of this._keypoints) {
        let { image } = kp
        if (image) {
          image.style.opacity = kp.opacity.toString()
          image.style.zIndex = kp.zIndex.toString()
        }
      }
    })
  }

  /**
   * @param {Object} options
   * @param {string} [options.url]
   * @param {string} [options.filter]
   * @param {string} [options.operation]
   * @param {number} [options.value]
   * @returns {string}
   */
  _imageSrc({ url = this._url, filter = this._filter, operation, value } = {}) {
    let transformations = { ...this._transformations }

    if (operation) {
      transformations[operation] = filter
        ? { name: filter, amount: value }
        : value
    }

    // do not use getBoundingClientRect because scale transform affects it
    let width = this.offsetWidth
    return viewerImageSrc(url, width, transformations)
  }

  /**
   * @param {string} operation
   * @param {number} value
   * @returns {Keypoint}
   */
  _constructKeypoint(operation, value) {
    let src = this._imageSrc({ operation, value })
    return {
      src,
      image: null,
      opacity: 0,
      zIndex: 0,
      value,
    }
  }

  /**
   * Check if current operation and filter equals passed ones
   *
   * @param {string} operation
   * @param {string} [filter]
   * @returns {boolean}
   */
  _isSame(operation, filter) {
    return this._operation === operation && this._filter === filter
  }

  /**
   * @param {string} operation
   * @param {string | null} filter
   * @param {number} value
   */
  _addKeypoint(operation, filter, value) {
    let shouldSkip = () =>
      !this._isSame(operation, filter) ||
      this._value !== value ||
      !!this._keypoints.find((kp) => kp.value === value)

    if (shouldSkip()) {
      return
    }
    let keypoint = this._constructKeypoint(operation, value)
    let image = new Image()
    image.src = keypoint.src
    let stop = this._handleImageLoading(keypoint.src)
    image.addEventListener('load', stop, { once: true })
    image.addEventListener('error', stop, { once: true })
    keypoint.image = image
    image.classList.add('image')

    image.addEventListener(
      'load',
      () => {
        if (shouldSkip()) {
          return
        }
        let keypoints = this._keypoints
        let idx = keypoints.findIndex((kp) => kp.value > value)
        let insertBeforeNode =
          idx < keypoints.length ? keypoints[idx].image : null
        if (
          !this._container ||
          (insertBeforeNode && !this._container.contains(insertBeforeNode))
        ) {
          return
        }
        keypoints.splice(idx, 0, keypoint)
        this._container.insertBefore(image, insertBeforeNode)
        this._update(operation, value)
      },
      { once: true },
    )

    image.addEventListener(
      'error',
      () => {
        this.pub('*networkProblems', true)
      },
      { once: true },
    )
  }

  /** @param {string | number} value */
  set(value) {
    value = typeof value === 'string' ? parseInt(value, 10) : value
    this._update(this._operation, value)
    this._addKeypointDebounced(this._operation, this._filter, value)
  }

  /**
   * @param {string} operation
   * @param {number} value
   */
  _update(operation, value) {
    this._operation = operation
    this._value = value

    let { zero } = COLOR_OPERATIONS_CONFIG[operation]

    let keypointValues = this._keypoints.map((kp) => kp.value)
    let opacities = calculateOpacities(keypointValues, value, zero)
    let zIndices = calculateZIndices(keypointValues, zero)

    for (let [idx, kp] of Object.entries(this._keypoints)) {
      kp.opacity = opacities[idx]
      kp.zIndex = zIndices[idx]
    }

    this._flush()
  }

  _createPreviewImage() {
    let image = new Image()
    image.classList.add('image', 'image--preview')
    image.style.opacity = '0'
    return image
  }

  async _initNodes() {
    let fr = document.createDocumentFragment()
    this._previewImage = this._previewImage || this._createPreviewImage()
    !this.contains(this._previewImage) && fr.appendChild(this._previewImage)

    let container = document.createElement('div')
    fr.appendChild(container)

    let srcList = this._keypoints.map((kp) => kp.src)

    let { images, promise, cancel } = batchPreloadImages(srcList)
    images.forEach((node) => {
      let stop = this._handleImageLoading(node.src)
      node.addEventListener('load', stop)
      node.addEventListener('error', stop)
    })
    this._cancelLastImages = () => {
      cancel()
      this._cancelLastImages = undefined
    }
    let operation = this._operation
    let filter = this._filter
    await promise
    if (this._isActive && this._isSame(operation, filter)) {
      this._container && this._container.remove()
      this._container = container
      this._keypoints.forEach((kp, idx) => {
        let kpImage = images[idx]
        kpImage.classList.add('image')
        kp.image = kpImage
        this._container.appendChild(kpImage)
      })
      this.appendChild(fr)
      this._flush()
    }
  }

  /** @param {import('../../../src/types/UploadEntry.js').Transformations} transformations */
  setTransformations(transformations) {
    this._transformations = transformations
    if (this._previewImage) {
      let src = this._imageSrc()
      let stop = this._handleImageLoading(src)
      this._previewImage.src = src
      this._previewImage.addEventListener('load', stop, { once: true })
      this._previewImage.addEventListener('error', stop, { once: true })
      this._previewImage.style.opacity = '1'

      this._previewImage.addEventListener(
        'error',
        () => {
          this.pub('*networkProblems', true)
        },
        { once: true },
      )
    }
  }

  /**
   * @param {object} options
   * @param {string} options.url
   * @param {string} options.operation
   * @param {number} options.value
   * @param {string} [options.filter]
   */
  preload({ url, filter, operation, value }) {
    this._cancelBatchPreload && this._cancelBatchPreload()

    let keypoints = keypointsRange(operation, value)
    let srcList = keypoints.map((kp) =>
      this._imageSrc({ url, filter, operation, value: kp }),
    )
    let { cancel } = batchPreloadImages(srcList)

    this._cancelBatchPreload = cancel
  }

  _setOriginalSrc(src) {
    let image = this._previewImage || this._createPreviewImage()
    !this.contains(image) && this.appendChild(image)
    this._previewImage = image

    if (image.src === src) {
      image.style.opacity = '1'
      image.style.transform = 'scale(1)'
      this.className = classNames({
        active_from_viewer: this._fromViewer,
        active_from_cropper: !this._fromViewer,
        inactive_to_cropper: false,
        inactive_rough: false,
      })
      return
    }
    image.style.opacity = '0'
    let stop = this._handleImageLoading(src)
    image.addEventListener('error', stop, { once: true })
    image.src = src
    image.addEventListener(
      'load',
      () => {
        stop()
        if (image) {
          image.style.opacity = '1'
          image.style.transform = 'scale(1)'
          this.className = classNames({
            active_from_viewer: this._fromViewer,
            active_from_cropper: !this._fromViewer,
            inactive_to_cropper: false,
            inactive_rough: false,
          })
        }
      },
      { once: true },
    )
    image.addEventListener(
      'error',
      () => {
        this.pub('*networkProblems', true)
      },
      { once: true },
    )
  }

  /**
   * @param {object} options
   * @param {string} options.url
   * @param {string} [options.operation]
   * @param {number} [options.value]
   * @param {string} [options.filter]
   * @param {boolean} [options.fromViewer]
   */
  activate({ url, operation, value, filter, fromViewer }) {
    this._isActive = true
    this._hidden = false
    this._url = url
    this._operation = operation
    this._value = value
    this._filter = filter
    this._fromViewer = fromViewer

    let isOriginal = typeof value !== 'number' && !filter
    if (isOriginal) {
      let src = this._imageSrc({ operation, value })
      this._setOriginalSrc(src)
      this._container && this._container.remove()
      return
    }
    this._keypoints = keypointsRange(operation, value).map((keyValue) =>
      this._constructKeypoint(operation, keyValue),
    )

    this._update(operation, value)
    this._initNodes()
  }

  deactivate({ hide = true, seamlessTransition = true } = {}) {
    this._isActive = false

    this._cancelLastImages && this._cancelLastImages()
    this._cancelBatchPreload && this._cancelBatchPreload()

    if (hide && !this._hidden) {
      this._hidden = true
      if (this._previewImage) {
        this._previewImage.style.transform = 'scale(1)'
      }
      this.className = classNames({
        'active_from_viewer': false,
        'active_from_cropper': false,
        'inactive_to_cropper': seamlessTransition,
        'inactive_rough': !seamlessTransition
      })
      this.addEventListener(
        'transitionend',
        () => {
          this._container && this._container.remove()
        },
        { once: true },
      )
    } else {
      this._container && this._container.remove()
    }
  }

  readyCallback() {
    super.readyCallback()

    setTimeout(() => {
      this.sub('loadingMap', (loadingMap) => {
        this.pub('*loadingOperations', loadingMap)
      })
    }, 0)
  }
}

EditorImageFader.renderShadow = false

EditorImageFader.is = 'editor-image-fader'
