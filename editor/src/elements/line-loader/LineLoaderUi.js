import { AppComponent } from '../../AppComponent.js'

export class LineLoaderUi extends AppComponent {
  constructor() {
    super()

    this._active = false

    this._handleTransitionEndRight = () => {
      let lineEl = this['line-el']
      lineEl.style.transition = `initial`
      lineEl.style.opacity = '0'
      lineEl.style.transform = `translateX(-100%)`
      this._active && this._start()
    }
  }

  readyCallback() {
    super.readyCallback()
    this.defineAccessor('active', (active) => {
      if (typeof active === 'boolean') {
        if (active) {
          this._start()
        } else {
          this._stop()
        }
      }
    })
  }

  _start() {
    this._active = true
    let { width } = this.getBoundingClientRect()
    let lineEl = this['line-el']
    lineEl.style.transition = `transform 1s`
    lineEl.style.opacity = '1'
    lineEl.style.transform = `translateX(${width}px)`
    lineEl.addEventListener('transitionend', this._handleTransitionEndRight, {
      once: true,
    })
  }

  _stop() {
    this._active = false
  }
}

LineLoaderUi.template = /*html*/ `
  <div class="inner">
    <div class="line" ref="line-el"></div>
  </div>
`

LineLoaderUi.is = 'line-loader-ui'
