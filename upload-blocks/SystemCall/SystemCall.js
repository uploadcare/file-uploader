import { BaseComponent } from '../../symbiote/core/BaseComponent.js';

export class SystemCall extends BaseComponent {

  readyCallback() {
    this.addToExternalState({
      multiple: true,
      accept: 'image/*',
      files: [],
      systemTrigger: null,
    });
    this.externalState.sub('systemTrigger', (val) => {
      if (!val) {
        return;
      }
      this.ref.input.dispatchEvent(new MouseEvent('click'));
    });
    this.externalState.sub('uploadCollection', (collection) => {
      /** @type {import('../../symbiote/core/TypedCollection.js').TypedCollection} */
      this.collection = collection;
    });
    this.ref.input.onchange = () => {
      let files = [...this.ref.input['files']];
      files.forEach((/** @type {File} */ file) => {
        this.collection.add({
          file,
          isImage: file.type.includes('image'),
          mimeType: file.type,
          fileName: file.name,
          fileSize: file.size,
        });
      });
      this.externalState.multiPub({
        currentActivity: 'upload-list',
        modalActive: true,
      });
      this.ref.input['value'] = '';
    };
  }
}

SystemCall.template = /*html*/ `
<input 
  hidden
  ref="input"
  type="file"
  ext="@multiple: multiple; @accept: accept">`;