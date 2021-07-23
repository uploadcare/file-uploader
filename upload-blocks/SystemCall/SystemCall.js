import { AppComponent } from '../AppComponent/AppComponent.js';

export class SystemCall extends AppComponent {

  connectedCallback() {
    if (!this._hasSubs) {
      super.connectedCallback();
      this.addToAppState({
        multiple: true,
        accept: 'image/*',
        files: [],
        systemTrigger: null,
      });
      this.appState.sub('systemTrigger', (val) => {
        if (!val) {
          return;
        }
        this.ref.input.dispatchEvent(new MouseEvent('click'));
      });
      this.appState.sub('uploadCollection', (collection) => {
        /** @type {import('../AppComponent/TypedCollection.js').TypedCollection} */
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
          });
        });
        this.appState.pub('currentActivity', 'upload-list');
        this.appState.pub('modalActive', true);
        this.ref.input['value'] = '';
      };
      this._hasSubs = true;
    }
  }
}

SystemCall.template = /*html*/ `
<input 
  hidden
  ref="input"
  type="file"
  app="@multiple: multiple; @accept: accept">`;