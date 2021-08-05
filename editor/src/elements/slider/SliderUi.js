import { AppComponent } from '../../AppComponent.js'
import { ResizeObserver } from '../../lib/ResizeObserver.js'

export class SliderUi extends AppComponent {
  constructor() {
    super()
    this.setAttribute('with-effects', '')
    this.state = {
      disabled: false,
      min: 0,
      max: 100,
      onInput: null,
      onChange: null,
      defaultValue: null,
      'on.sliderInput': () => {
        let value = parseInt(this['input-el'].value, 10)
        this._updateValue(value)
        this.state.onInput && this.state.onInput(value)
      },
      'on.sliderChange': () => {
        let value = parseInt(this['input-el'].value, 10)
        this.state.onChange && this.state.onChange(value)
      },
    }
  }

  readyCallback() {
    super.readyCallback()

    this.defineAccessor('disabled', (disabled) => {
      this.state.disabled = disabled
    })

    this.defineAccessor('min', (min) => {
      this.state.min = min
    })

    this.defineAccessor('max', (max) => {
      this.state.max = max
    })

    this.defineAccessor('defaultValue', (defaultValue) => {
      this.state.defaultValue = defaultValue
      this['input-el'].value = defaultValue
      this._updateValue(defaultValue)
    })

    this.defineAccessor('zero', (zero) => {
      this._zero = zero
    })

    this.defineAccessor('onInput', (onInput) => {
      if (!onInput) return
      this.state.onInput = onInput
    })

    this.defineAccessor('onChange', (onChange) => {
      if (!onChange) return
      this.state.onChange = onChange
    })
  }

  _updateValue(value) {
    this._updateZeroDot(value)

    let { width } = this.getBoundingClientRect()
    let slope = 100 / (this.state.max - this.state.min)
    let mappedValue = slope * (value - this.state.min)
    let offset = (mappedValue * (width - this._thumbSize)) / 100
    window.requestAnimationFrame(() => {
      this['thumb-el'].style.transform = `translateX(${offset}px)`
    })
  }

  _updateZeroDot(value) {
    if (!this._zeroDotEl) {
      return
    }
    if (value === this._zero) {
      this._zeroDotEl.style.opacity = '0'
    } else {
      this._zeroDotEl.style.opacity = '0.2'
    }
    let { width } = this.getBoundingClientRect()
    let slope = 100 / (this.state.max - this.state.min)
    let mappedValue = slope * (this._zero - this.state.min)
    let offset = (mappedValue * (width - this._thumbSize)) / 100
    window.requestAnimationFrame(() => {
      this._zeroDotEl.style.transform = `translateX(${offset}px)`
    })
  }

  _updateSteps() {
    const STEP_GAP = 15

    let stepsEl = this['steps-el']
    let { width } = stepsEl.getBoundingClientRect()
    let half = Math.ceil(width / 2)
    let count = Math.ceil(half / STEP_GAP) - 2

    if (this._stepsCount === count) {
      return
    }

    let fr = document.createDocumentFragment()
    let minorStepEl = document.createElement('div')
    let borderStepEl = document.createElement('div')
    minorStepEl.className = 'minor-step'
    borderStepEl.className = 'border-step'
    fr.appendChild(borderStepEl)
    for (let i = 0; i < count; i++) {
      fr.appendChild(minorStepEl.cloneNode())
    }
    fr.appendChild(borderStepEl.cloneNode())
    for (let i = 0; i < count; i++) {
      fr.appendChild(minorStepEl.cloneNode())
    }
    fr.appendChild(borderStepEl.cloneNode())

    let zeroDotEl = document.createElement('div')
    zeroDotEl.className = 'zero-dot'
    fr.appendChild(zeroDotEl)
    this._zeroDotEl = zeroDotEl

    stepsEl.innerHTML = ''
    stepsEl.appendChild(fr)
    this._stepsCount = count
  }

  connectedCallback() {
    super.connectedCallback()

    this._updateSteps()

    this._observer = new ResizeObserver(() => {
      this._updateSteps()
      let value = parseInt(this['input-el'].value, 10)
      this._updateValue(value)
    })
    this._observer.observe(this)

    this._thumbSize = parseInt(
      this.style.getPropertyValue('--l-thumb-size'),
      10,
    )

    setTimeout(() => {
      let value = parseInt(this['input-el'].value, 10)
      this._updateValue(value)
    }, 0)

    this.sub('disabled', (disabled) => {
      let el = this['input-el']
      if (disabled) {
        el.setAttribute('disabled', 'disabled')
      } else {
        el.removeAttribute('disabled')
      }
    })

    let inputEl = this.ref('input-el')
    inputEl.addEventListener('focus', () => {
      this.style.setProperty('--color-effect', 'var(--hover-color-rgb)')
    })
    inputEl.addEventListener('blur', () => {
      this.style.setProperty('--color-effect', 'var(--idle-color-rgb)')
    })
  }

  disconnectedCallback() {
    this._observer.unobserve(this)
    this._observer = undefined
  }
}
SliderUi.template = /*html*/ `
  <div class="steps" ref="steps-el">
  </div>
  <div ref="thumb-el" class="thumb"></div>
  <input class="input" type='range' ref='input-el' tabindex="0" set="oninput: on.sliderInput; onchange: on.sliderChange; @min: min; @max: max; @value: defaultValue;">
`

SliderUi.is = 'slider-ui'
