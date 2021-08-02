import { AppComponent } from './AppComponent.js'
import { constructCdnUrl, transformationsToString } from './lib/cdnUtils.js'
import { classNames } from './lib/classNames.js'
import { debounce } from './lib/debounce.js'
import { preloadImage } from './lib/preloadImage.js'
import { TRANSPARENT_PIXEL_SRC } from './lib/transparentPixelSrc.js'
// import { BREAKPOINTS } from '../../shared-styles/design-system.js';
import { initState } from './state.js'
import { TEMPLATE } from './template.js'
import { TabId } from './toolbar-constants.js'
import { viewerImageSrc } from './util.js'

export class UploadcareEditor extends AppComponent {
  constructor() {
    super()
    this.state = initState(this)

    this._debouncedShowLoader = debounce(this._showLoader.bind(this), 300)
  }

  _showLoader(show) {
    this.state.showLoader = show
  }

  _loadImageFromCdn() {
    this._debouncedShowLoader(true)
    let src = this._imageSrc()
    let { promise, cancel } = preloadImage(src)
    promise
      .then(() => {
        this.state.src = src
      })
      .catch((err) => {
        this.state.networkProblems = true
        this._debouncedShowLoader(false)
        this.state.src = src
      })
    this._cancelPreload && this._cancelPreload()
    this._cancelPreload = cancel
  }

  _imageSrc() {
    let { width } = this['img-container-el'].getBoundingClientRect()
    return viewerImageSrc(this.state.originalUrl, width, {})
  }

  readyCallback() {
    super.readyCallback()

    // TODO: fix hardcode
    this.state.originalUrl = `https://ucarecdn.com/${this.state.uuid}/`

    fetch(`${this.state.originalUrl}-/json/`)
      .then((response) => response.json())
      .then(({ width, height }) => {
        this.state.imageSize = { width, height }
      })

    this._loadImageFromCdn()

    this.state.editorToolbarEl = this['editor-toolbar-el']
    this.state.faderEl = this['fader-el']
    this.state.cropperEl = this['cropper-el']
    this.state.imgContainerEl = this['img-container-el']

    this.classList.add('editor_ON')

    this.sub('networkProblems', (networkProblems) => {
      this.state['presence.networkProblems'] = networkProblems
      this.state['presence.modalCaption'] = !networkProblems
    })

    this['img-el'].addEventListener('load', (e) => {
      this._imgLoading = false
      this._debouncedShowLoader(false)

      if (this.state.src !== TRANSPARENT_PIXEL_SRC) {
        this.state.networkProblems = false
      }
    })

    this['img-el'].addEventListener('error', (e) => {
      this._imgLoading = false
      this._debouncedShowLoader(false)

      this.state.networkProblems = true
    })

    // this.sub('widthBreakpoint', (bp) => {
    //   this.state['css.wrapper'] = bp < BREAKPOINTS.max ? 'wrapper _mobile' : 'wrapper _desktop';
    // });

    this.sub('src', (src) => {
      let el = this.ref('img-el')
      if (el.src !== src) {
        this._imgLoading = true
        el.src = src || TRANSPARENT_PIXEL_SRC
      }
    })

    this.state.editorToolbarEl.sub('tabId', (tabId) => {
      this['img-el'].className = classNames('image', {
        image_hidden_to_cropper: tabId === TabId.CROP,
        image_hidden_effects: tabId !== TabId.CROP,
      })
    })

    this.sub('transformations', (transformations) => {
      if (!transformations) {
        return
      }
      let transformationsUrl = constructCdnUrl(
        this.state.originalUrl,
        transformationsToString(transformations),
        'preview',
      )

      this.dispatchEvent(
        new CustomEvent('apply', {
          detail: {
            originalUrl: this.state.originalUrl,
            transformationsUrl,
            transformations,
          },
        }),
      )
    })
  }

  disconnectedCallback() {
    super.disconnectedCallback()
  }
}

UploadcareEditor.reflectToState(['uuid', 'public-key'])
UploadcareEditor.template = TEMPLATE
UploadcareEditor.flowInitiator(true)
UploadcareEditor.topLevel(true)

UploadcareEditor.is = 'uc-editor'
