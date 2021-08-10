import { applyElementStyles } from '../../symbiote/core/css_utils.js'
import { AppComponent } from './AppComponent.js'
import { viewerImageSrc } from './viewer_util.js'
import { CropFrame } from './CropFrame.js'
import { intersectionRect, constraintRect, minRectSize } from './crop-utils.js'
import { CROP_PADDING, MIN_CROP_SIZE } from './cropper-constants.js'
import { debounce } from './lib/debounce.js'
import { ResizeObserver } from './lib/ResizeObserver.js'
import { pick } from './lib/pick.js'
import { preloadImage } from './lib/preloadImage.js'
import { classNames } from './lib/classNames.js'

/**
 * @typedef {Object} Rectangle
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} Operations
 * @property {boolean} flip
 * @property {boolean} mirror
 * @property {number} rotate
 */

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/**
 * @param {{ width: number; height: number }} size
 * @param {number} angle
 * @returns {{ width: number; height: number }}
 */
function rotateSize({ width, height }, angle) {
  let swap = (angle / 90) % 2 !== 0
  return { width: swap ? height : width, height: swap ? width : height }
}

/**
 * @param {import('../../../src/types/UploadEntry.js').Transformations['crop']} crop
 * @returns {boolean}
 */
function validateCrop(crop) {
  if (!crop) {
    return true
  }
  /** @type {((arg: typeof crop) => boolean)[]} */
  let shouldMatch = [
    ({ dimensions, coords }) =>
      [...dimensions, ...coords].every(
        (number) => Number.isInteger(number) && Number.isFinite(number),
      ),
    ({ dimensions, coords }) =>
      dimensions.every((d) => d > 0) && coords.every((c) => c >= 0),
  ]
  return shouldMatch.every((matcher) => matcher(crop))
}

export class EditorImageCropper extends AppComponent {
  constructor() {
    super()

    this.state = {
      ctxProvider: this,
      image: null,
      padding: CROP_PADDING,
      /** @type {Operations} */
      operations: {
        rotate: 0,
        mirror: false,
        flip: false,
      },
      /** @type {Rectangle} */
      imageBox: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
      /** @type {Rectangle} */
      cropBox: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
    }

    this._commitDebounced = debounce(this._commit.bind(this), 300)
    this._handleResizeDebounced = debounce(this._handleResize.bind(this), 10)
  }

  _handleResize() {
    this._initCanvas()
    this._alignImage()
    this._alignCrop()
    this._draw()
  }

  _syncTransformations() {
    let transformations = this.read('*editorTransformations')
    let pickedTransformations = pick(
      transformations,
      Object.keys(this.state.operations),
    )
    let operations = { ...this.state.operations, ...pickedTransformations }
    this.state.operations = operations
  }

  _initCanvas() {
    /** @type {HTMLCanvasElement} */
    let canvas = this['canvas-el']
    let ctx = canvas.getContext('2d')

    let width = this.offsetWidth
    let height = this.offsetHeight
    let dpr = window.devicePixelRatio
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    this._canvas = canvas
    this._ctx = ctx
  }

  _alignImage() {
    if (!this._isActive || !this.state.image) {
      return
    }

    let { image, padding, operations } = this.state
    let { rotate } = operations

    let bounds = { width: this.offsetWidth, height: this.offsetHeight }
    let naturalSize = rotateSize(
      { width: image.naturalWidth, height: image.naturalHeight },
      rotate,
    )

    if (
      naturalSize.width > bounds.width - padding * 2 ||
      naturalSize.height > bounds.height - padding * 2
    ) {
      let imageAspectRatio = naturalSize.width / naturalSize.height
      let viewportAspectRatio = bounds.width / bounds.height

      if (imageAspectRatio > viewportAspectRatio) {
        let width = bounds.width - padding * 2
        let height = width / imageAspectRatio
        let x = 0 + padding
        let y = padding + (bounds.height - padding * 2) / 2 - height / 2
        this.state.imageBox = { x, y, width, height }
      } else {
        let height = bounds.height - padding * 2
        let width = height * imageAspectRatio
        let x = padding + (bounds.width - padding * 2) / 2 - width / 2
        let y = 0 + padding
        this.state.imageBox = { x, y, width, height }
      }
    } else {
      let { width, height } = naturalSize
      let x = padding + (bounds.width - padding * 2) / 2 - width / 2
      let y = padding + (bounds.height - padding * 2) / 2 - height / 2
      this.state.imageBox = { x, y, width, height }
    }
  }

  _alignCrop() {
    let { imageBox, cropBox, operations } = this.state
    let { rotate } = operations
    let transformation = this.read('*editorTransformations')['crop']

    if (transformation) {
      let {
        dimensions: [width, height],
        coords: [x, y],
      } = transformation
      let {
        width: previewWidth,
        x: previewX,
        y: previewY,
      } = this.state.imageBox
      let { width: sourceWidth } = rotateSize(this._imageSize, rotate)
      let ratio = previewWidth / sourceWidth
      cropBox = {
        x: previewX + x * ratio,
        y: previewY + y * ratio,
        width: width * ratio,
        height: height * ratio,
      }
    } else {
      cropBox = {
        x: imageBox.x,
        y: imageBox.y,
        width: imageBox.width,
        height: imageBox.height,
      }
    }
    /** @type {[number, number]} */
    let minCropRect = [
      Math.min(imageBox.width, MIN_CROP_SIZE),
      Math.min(imageBox.height, MIN_CROP_SIZE),
    ]
    cropBox = minRectSize(cropBox, minCropRect, 'se')
    cropBox = constraintRect(cropBox, imageBox)

    this.state.cropBox = cropBox
  }

  _drawImage() {
    let { image, imageBox, operations } = this.state
    let { mirror, flip, rotate } = operations
    let ctx = this._ctx
    let rotated = rotateSize(
      { width: imageBox.width, height: imageBox.height },
      rotate,
    )
    ctx.save()
    ctx.translate(
      imageBox.x + imageBox.width / 2,
      imageBox.y + imageBox.height / 2,
    )
    ctx.rotate((rotate * Math.PI * -1) / 180)
    ctx.scale(mirror ? -1 : 1, flip ? -1 : 1)
    ctx.drawImage(
      image,
      -rotated.width / 2,
      -rotated.height / 2,
      rotated.width,
      rotated.height,
    )
    ctx.restore()
  }

  _draw() {
    if (!this._isActive || !this.state.image) {
      return
    }
    let canvas = this._canvas
    let ctx = this._ctx

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    this._drawImage()
  }

  _animateIn({ fromViewer }) {
    if (this.state.image) {
      this.ref('frame-el').toggleThumbs(true)
      this._alignTransition()
      setTimeout(() => {
        this.className = classNames({
          active_from_viewer: fromViewer,
          active_from_editor: !fromViewer,
          inactive_to_editor: false,
          inactive_instant: false,
        })
      })
    }
  }

  /** @returns {import('../../../src/types/UploadEntry.js').Transformations['crop']['dimensions']} */
  _calculateDimensions() {
    let { imageBox, cropBox, operations } = this.state
    let { rotate } = operations
    let { width: previewWidth, height: previewHeight } = imageBox
    let { width: sourceWidth, height: sourceHeight } = rotateSize(
      this._imageSize,
      rotate,
    )
    let { width: cropWidth, height: cropHeight } = cropBox
    let ratioW = previewWidth / sourceWidth
    let ratioH = previewHeight / sourceHeight

    /** @type {[number, number]} */
    let dimensions = [
      clamp(Math.round(cropWidth / ratioW), 1, sourceWidth),
      clamp(Math.round(cropHeight / ratioH), 1, sourceHeight),
    ]

    return dimensions
  }

  /** @returns {import('../../../src/types/UploadEntry.js').Transformations['crop']} */
  _calculateCrop() {
    let { imageBox, cropBox, operations } = this.state
    let { rotate } = operations
    let {
      width: previewWidth,
      height: previewHeight,
      x: previewX,
      y: previewY,
    } = imageBox
    let { width: sourceWidth, height: sourceHeight } = rotateSize(
      this._imageSize,
      rotate,
    )
    let { x: cropX, y: cropY } = cropBox
    let ratioW = previewWidth / sourceWidth
    let ratioH = previewHeight / sourceHeight

    let dimensions = this._calculateDimensions()
    let crop = {
      dimensions,
      coords: /** @type {[number, number]} */ ([
        clamp(
          Math.round((cropX - previewX) / ratioW),
          0,
          sourceWidth - dimensions[0],
        ),
        clamp(
          Math.round((cropY - previewY) / ratioH),
          0,
          sourceHeight - dimensions[1],
        ),
      ]),
    }
    if (!validateCrop(crop)) {
      console.error('Cropper is trying to create invalid crop object', {
        payload: crop,
      })
      return undefined
    }
    if (dimensions[0] === sourceWidth && dimensions[1] === sourceHeight) {
      return undefined
    }

    return crop
  }

  _commit() {
    let { operations } = this.state
    let { rotate, mirror, flip } = operations
    let crop = this._calculateCrop()
    /** @type {import('../../../src/types/UploadEntry.js').Transformations} */
    let editorTransformations = this.read('*editorTransformations')
    let transformations = {
      ...editorTransformations,
      crop,
      rotate,
      mirror,
      flip,
    }

    this.pub('*editorTransformations', transformations)
  }

  setValue(operation, value) {
    console.log(`Apply cropper operation [${operation}=${value}]`)
    this.state.operations = {
      ...this.state.operations,
      [operation]: value,
    }

    if (!this._isActive) {
      return
    }

    this._alignImage()
    this._alignCrop()
    this._draw()
  }

  /**
   * @param {keyof Operations} operation
   * @returns {number | boolean}
   */
  getValue(operation) {
    return this.state.operations[operation]
  }

  async activate(imageSize, { fromViewer }) {
    if (this._isActive) {
      return
    }
    this._isActive = true
    this._imageSize = imageSize
    this.removeEventListener('transitionend', this._reset)
    this._initCanvas()

    try {
      this.state.image = await this._waitForImage(
        this.read('*originalUrl'),
        this.read('*editorTransformations'),
      )
      this._syncTransformations()
      this._alignImage()
      this._alignCrop()
      this._draw()
      this._animateIn({ fromViewer })
    } catch (err) {
      console.error('Failed to activate cropper', { error: err })
    }
  }

  deactivate({ seamlessTransition = false } = {}) {
    if (!this._isActive) {
      return
    }
    this._commit()
    this._isActive = false

    if (seamlessTransition) {
      this._alignTransition()
    }

    this.className = classNames({
      active_from_viewer: false,
      active_from_editor: false,
      inactive_to_editor: seamlessTransition,
      inactive_instant: !seamlessTransition,
    })

    this.ref('frame-el').toggleThumbs(false)
    this.addEventListener('transitionend', this._reset, { once: true })
  }

  _alignTransition() {
    let dimensions = this._calculateDimensions()
    let scaleX =
      Math.min(this.offsetWidth - this.state.padding * 2, dimensions[0]) /
      this.state.cropBox.width
    let scaleY =
      Math.min(this.offsetHeight - this.state.padding * 2, dimensions[1]) /
      this.state.cropBox.height
    let scale = Math.min(scaleX, scaleY)
    let cropCenterX = this.state.cropBox.x + this.state.cropBox.width / 2
    let cropCenterY = this.state.cropBox.y + this.state.cropBox.height / 2

    this.style.transform = `scale(${scale}) translate(${
      (this.offsetWidth / 2 - cropCenterX) / scale
    }px, ${(this.offsetHeight / 2 - cropCenterY) / scale}px)`
    this.style.transformOrigin = `${cropCenterX}px ${cropCenterY}px`
  }

  _reset() {
    if (this._isActive) {
      return
    }
    this.state.image = null
  }

  /**
   * @param {string} originalUrl
   * @param {import('../../../src/types/UploadEntry.js').Transformations} transformations
   * @returns {Promise<HTMLImageElement>}
   */
  _waitForImage(originalUrl, transformations) {
    let width = this.offsetWidth
    transformations = {
      ...transformations,
      crop: undefined,
      rotate: undefined,
      flip: undefined,
      mirror: undefined,
    }
    let src = viewerImageSrc(originalUrl, width, transformations)
    let { promise, cancel, image } = preloadImage(src)

    let stop = this._handleImageLoading(src)
    image.addEventListener('load', stop, { once: true })
    image.addEventListener('error', stop, { once: true })
    this._cancelPreload && this._cancelPreload()
    this._cancelPreload = cancel

    return promise
      .then(() => image)
      .catch((err) => {
        console.error('Failed to load image', { error: err })
        this.pub('*networProblems', true)
        return Promise.resolve(image)
      })
  }

  _handleImageLoading(src) {
    let operation = 'crop'
    let loadingOperations = { ...this.read('*loadingOperations') }
    if (!loadingOperations[operation]) {
      loadingOperations[operation] = {}
    }

    loadingOperations = {
      ...loadingOperations,
      [operation]: {
        ...loadingOperations[operation],
        [src]: true,
      },
    }

    this.pub('*loadingOperations', loadingOperations)

    return () => {
      delete loadingOperations[operation][src]
      this.pub('*loadingOperations', loadingOperations)
    }
  }

  readyCallback() {
    super.readyCallback()

    this._observer = new ResizeObserver(() => {
      if (this._isActive && this.state.image) {
        this._handleResizeDebounced()
      }
    })
    this._observer.observe(this)

    this.sub('imageBox', () => {
      this._draw()
    })

    this.sub('cropBox', (cropBox) => {
      if (this.state.image) {
        this._commitDebounced()
      }
    })

    setTimeout(() => {
      this.sub('*networkProblems', (networkProblems) => {
        if (!networkProblems) {
          this._isActive &&
            this.activate(this._imageSize, { fromViewer: false })
        }
      })
    }, 0)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._observer.unobserve(this)
    this._observer = undefined
  }
}

EditorImageCropper.renderShadow = false

EditorImageCropper.template = /*html*/ `
  <canvas class='canvas' ref='canvas-el'></canvas>
  <${CropFrame.is} ref='frame-el' set="dataCtxProvider: ctxProvider"></${CropFrame.is}>
`

EditorImageCropper.is = 'editor-image-cropper'
