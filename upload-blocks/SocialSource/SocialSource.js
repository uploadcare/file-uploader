import { BlockComponent } from '../BlockComponent/BlockComponent.js'

export class SocialSource extends BlockComponent {
  constructor() {
    super()

    this.initLocalState({
    })
  }

  initCallback() {

  }

  mountEditor() {
    let editorClass = window.customElements.get('uc-editor')
    let instance = new editorClass()

    let uuid = this.localState.read('uuid')
    let publicKey = this.externalState.read('pubkey')

    this.innerHTML = ''
    this.style.width = '600px';
    this.style.height = '400px';
    this.appendChild(instance)
  }

  unmountEditor() {
    this.style.width = '0px';
    this.style.height = '0px';
    this.innerHTML = ''
  }
}

SocialSource.template = /*html*/ ``
