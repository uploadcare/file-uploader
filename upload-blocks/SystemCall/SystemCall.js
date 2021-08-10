import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class SystemCall extends BlockComponent {

  initCallback() {
    this.addToExternalState({
      multiple: true,
      accept: 'image/*',
      files: [],
      systemTrigger: null,
    });
    this.sub('external', 'systemTrigger', (val) => {
      if (!val) {
        return;
      }
      this.ref.input.dispatchEvent(new MouseEvent('click'));
    });

    this.ref.input.onchange = () => {
      let files = [...this.ref.input['files']];
      files.forEach((/** @type {File} */ file) => {
        this.uploadCollection.add({
          file,
          isImage: file.type.includes('image'),
          mimeType: file.type,
          fileName: file.name,
          fileSize: file.size,
        });
      });
      this.multiPub('external', {
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