import { BlockComponent } from '../BlockComponent/BlockComponent.js'
import { registerMessage, unregisterMessage } from './messages.js'
import { uploadFromUrl, getInfo } from '../../common-utils/UploadClientLight.js'

export class ExternalSource extends BlockComponent {
  constructor() {
    super()

    this._externalSourceType = null
    this._iframe = null
  }

  initCallback() {
    this.style.display = 'flex'
    this.style.position = 'relative'
    this.style.backgroundColor = '#ffffff'

    this.addToExternalState({
      externalSourceType: null,
    })

    this.externalState.sub('externalSourceType', (externalSourceType) => {
      this._externalSourceType = externalSourceType
    })

    this.externalState.sub('currentActivity', (val) => {
      if (val === 'external-source') {
        this.mountIframe()
      } else if (this._iframe) {
        this.unmountIframe()
      }
    })
  }

  async handleFileSelected(message) {
    // TODO: check for alternatives, see https://github.com/uploadcare/uploadcare-widget/blob/f5d3e8c9f67781bed2eb69814c8f86a4cc035473/src/widget/tabs/remote-tab.js#L102
    let { url } = message
    let pubkey = this.config.PUBKEY
    let entry = this.uploadCollection.add({
      externalUrl: url,
    })
    this.pub('external', 'currentActivity', 'upload-list')
    await uploadFromUrl(url, pubkey, async (info) => {
      if (info.type === 'progress') {
        entry.setValue('uploadProgress', info.progress)
      }
      if (info.type === 'success') {
        let fileInfo = await getInfo(info.uuid, pubkey)
        console.log(fileInfo)
        entry.setMultipleValues({
          uuid: fileInfo.uuid,
          fileName: fileInfo.filename,
          fileSize: fileInfo.size,
          isImage: fileInfo.is_image,
          mimeType: fileInfo.mime_type,
        })
      }
    })
  }

  remoteUrl() {
    let pubkey = this.config.PUBKEY
    let version = '3.11.3'
    let imagesOnly = (false).toString()

    return `https://social.uploadcare.com/window3/${this._externalSourceType}?lang=en&public_key=${pubkey}&widget_version=${version}&images_only=${imagesOnly}&pass_window_open=false`
  }

  mountIframe() {
    let iframe = document.createElement('iframe')

    iframe.setAttribute('src', this.remoteUrl())
    iframe.setAttribute('marginheight', '0')
    iframe.setAttribute('marginwidth', '0')
    iframe.setAttribute('frameborder', '0')
    iframe.setAttribute('allowTransparency', 'true')

    iframe.style.width = '100%'
    iframe.style.height = '100%'

    this.innerHTML = ''
    this.style.width = '600px'
    this.style.height = '400px'
    this.appendChild(iframe)

    registerMessage(
      'file-selected',
      iframe.contentWindow,
      this.handleFileSelected.bind(this),
    )

    this._iframe = iframe
  }

  unmountIframe() {
    unregisterMessage('file-selected', this._iframe.contentWindow)

    this.style.width = '0px'
    this.style.height = '0px'
    this.innerHTML = ''
    this._iframe = undefined
  }
}

ExternalSource.template = /*html*/ ``
