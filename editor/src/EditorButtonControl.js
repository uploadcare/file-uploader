import { setAriaClick } from '../../symbiote/core/render_utils.js'
import { AppComponent } from './AppComponent.js'
import { ucIconHtml } from './icons/ucIconHtml.js'
import { classNames } from './lib/classNames.js'

export class EditorButtonControl extends AppComponent {
  constructor() {
    super()

    this._iconName = null
    this._title = null

    this.state = {
      active: false,
      title: '',
      icon: '',
      'tpl.icon': '',
      'on.click': null,
    }
  }

  readyCallback() {
    super.readyCallback()

    this._titleEl = this.ref('title-el')
    this._iconEl = this.ref('icon-el')

    this.setAttribute('role', 'button')
    if (this.tabIndex === -1) {
      this.tabIndex = 0
    }

    this.sub('icon', (icon) => {
      if (icon) {
        this.state['tpl.icon'] = ucIconHtml(icon)
      }
    })

    this.sub('title', (title) => {
      let titleEl = this._titleEl
      if (titleEl) {
        this._titleEl.style.display = title ? 'block' : 'none'
      }
    })

    this.sub('active', (active) => {
      this.className = classNames({
        'active': active,
        'not_active': !active
      })
    })

    this.sub('on.click', (onClick) => {
      setAriaClick(this, onClick)
    })
  }
}

EditorButtonControl.renderShadow = false

EditorButtonControl.template = /*html*/ `
  <div class="before"></div>
  <div class="icon" set="innerHTML: tpl.icon"></div>
  <div class="title" ref="title-el" set="textContent: title"></div>
`

EditorButtonControl.is = 'editor-button-control'
