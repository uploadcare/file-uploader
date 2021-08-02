import { EditorButtonControl } from './EditorButtonControl.js'
import { FAKE_ORIGINAL_FILTER } from './EditorSlider.js'
import {
  COMMON_OPERATIONS,
  constructCdnUrl,
  transformationsToString,
} from './lib/cdnUtils.js'
import { preloadImage } from './lib/preloadImage.js'

export class EditorFilterControl extends EditorButtonControl {
  constructor() {
    super()

    this.state['on.click'] = (e) => {
      if (!this.state.active) {
        this._sliderEl.setOperation(this._operation, this._filter)
        this._sliderEl.apply()
      } else if (!this._isOriginal) {
        this._sliderEl.setOperation(this._operation, this._filter)
        this.pub('*showSlider', true)
      }

      this.pub('*currentFilter', this._filter)
    }

    this.defineAccessor('faderEl', (faderEl) => {
      /** @type {import('./EditorImageFader').EditorImageFader} */
      this._faderEl = faderEl
    })

    this.defineAccessor('sliderEl', (sliderEl) => {
      /** @type {import('./EditorSlider').EditorSlider} */
      this._sliderEl = sliderEl
    })

    this.defineAccessor('filter', (filter) => {
      this._operation = 'filter'
      this._filter = filter
      this._isOriginal = filter === FAKE_ORIGINAL_FILTER
      this.state.icon = this._isOriginal ? 'diagonal' : 'slider'
    })
  }

  _previewSrc() {
    let previewSize = parseInt(
      window.getComputedStyle(this).getPropertyValue('--l-base-min-width'),
      10,
    )
    let dpr = window.devicePixelRatio
    let size = Math.ceil(dpr * previewSize)
    let quality = dpr >= 2 ? 'lightest' : 'normal'
    let filterValue = 100

    /** @type {import('../../../src/types/UploadEntry.js').Transformations} */
    let transformations = { ...this.read('*editorTransformations') }
    transformations[this._operation] =
      this._filter === FAKE_ORIGINAL_FILTER
        ? undefined
        : {
            name: this._filter,
            amount: filterValue,
          }
    return constructCdnUrl(
      this._originalUrl,
      COMMON_OPERATIONS,
      transformationsToString(transformations),
      `quality/${quality}`,
      `scale_crop/${size}x${size}/center`,
    )
  }

  /**
   * @param {IntersectionObserverEntry[]} entries
   * @param {IntersectionObserver} observer
   */
  _observerCallback(entries, observer) {
    let intersectionEntry = entries[0]
    if (intersectionEntry.isIntersecting) {
      let src = this._previewSrc()
      let previewEl = this['preview-el']
      let { promise, cancel } = preloadImage(src)
      this._cancelPreload = cancel
      promise
        .catch((err) => {
          this.pub('*networkProblems', true)
          console.error('Failed to load image', { error: err })
        })
        .finally(() => {
          previewEl.style.backgroundImage = `url(${src})`
          setTimeout(() => {
            previewEl.style.opacity = '1'
          })

          // @ts-ignore
          observer.unobserve(this)
        })
    } else {
      this._cancelPreload && this._cancelPreload()
    }
  }

  readyCallback() {
    super.readyCallback()

    this._observer = new window.IntersectionObserver(
      this._observerCallback.bind(this),
      {
        threshold: [0, 1],
      },
    )

    let originalUrl = this.read('*originalUrl')
    this._originalUrl = originalUrl

    if (this._isOriginal) {
      this['icon-el'].classList.add('original-icon')
    } else {
      this._observer.observe(this)
    }

    this.sub('*currentFilter', (currentFilter) => {
      this.state.active = currentFilter && currentFilter === this._filter
    })

    this.sub('active', (active) => {
      if (this._isOriginal) {
        return
      }
      let iconEl = this['icon-el']
      iconEl.style.opacity = active ? '1' : '0'

      let previewEl = this['preview-el']
      if (active) {
        previewEl.style.opacity = '0'
      } else if (previewEl.style.backgroundImage) {
        previewEl.style.opacity = '1'
      }
    })

    this.sub('*networkProblems', (networkProblems) => {
      if (!networkProblems) {
        let src = this._previewSrc()
        let previewEl = this['preview-el']
        if (previewEl.style.backgroundImage) {
          previewEl.style.backgroundImage = 'none'
          previewEl.style.backgroundImage = `url(${src})`
        }
      }
    })
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    // @ts-ignore
    this._observer.unobserve(this)
    this._observer = undefined
    this._cancelPreload && this._cancelPreload()
  }
}

EditorFilterControl.template = /*html*/ `
  <div class="before"></div>
  <div class="preview" ref="preview-el"></div>
  <div class="icon" ref="icon-el" set="innerHTML: tpl.icon"></div>
`

EditorFilterControl.is = 'editor-filter-control'
