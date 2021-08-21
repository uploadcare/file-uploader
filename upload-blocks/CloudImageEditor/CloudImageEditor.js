import { BlockComponent } from '../BlockComponent/BlockComponent.js'

let EDITOR_SCRIPT_SRC =
  'https://ucarecdn.com/libs/editor/0.0.1-alpha.0.9/uploadcare-editor.js'

export class CloudImageEditor extends BlockComponent {
  constructor() {
    super()

    this.initLocalState({
      uuid: null,
    })
  }

  loadScript() {
    let script = document.createElement('script')
    script.src = EDITOR_SCRIPT_SRC
    script.setAttribute('type', 'module')
    document.body.appendChild(script)
  }

  initCallback() {
    this.style.display = 'flex'
    this.style.position = 'relative'

    this.loadScript()
    this.externalState.sub('currentActivity', (val) => {
      if (val === 'cloud-image-edit') {
        this.mountEditor()
      } else {
        this.unmountEditor()
      }
    })

    this.externalState.sub('focusedEntry', (
      /** @type {import('../../symbiote/core/TypedState.js').TypedState} */ entry,
    ) => {
      if (!entry) {
        return
      }
      this.entry = entry

      this.entry.subscribe('uuid', (uuid) => {
        if (uuid) {
          this.localState.pub('uuid', uuid)
        }
      })
    })
  }

  handleApply(e) {
    let result = e.detail
    let { transformationsUrl } = result
    this.entry.setValue('transformationsUrl', transformationsUrl)
    this.pub('external', 'currentActivity', 'upload-details')
  }

  handleCancel() {
    this.pub('external', 'currentActivity', 'upload-details')
  }

  mountEditor() {
    let editorClass = window.customElements.get('uc-editor')
    let instance = new editorClass()

    let uuid = this.localState.read('uuid')
    let publicKey = this.externalState.read('pubkey')
    instance.setAttribute('uuid', uuid)
    instance.setAttribute('public-key', publicKey)

    instance.addEventListener('apply', (result) => this.handleApply(result))
    instance.addEventListener('cancel', () => this.handleCancel())

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

CloudImageEditor.template = /*html*/ ``
