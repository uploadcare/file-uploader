import { BlockComponent } from '../BlockComponent/BlockComponent.js';

let EDITOR_SCRIPT_SRC = 'https://ucarecdn.com/libs/editor/0.0.1-alpha.0.9/uploadcare-editor.js';

export class CloudImageEditor extends BlockComponent {
  activityType = BlockComponent.activities.CLOUD_IMG_EDIT;

  init$ = {
    uuid: null,
  };

  loadScript() {
    let script = document.createElement('script');
    script.src = EDITOR_SCRIPT_SRC;
    script.setAttribute('type', 'module');
    document.body.appendChild(script);
  }

  initCallback() {
    this.style.display = 'flex';
    this.style.position = 'relative';

    this.bindCssData('--cfg-pubkey');

    this.loadScript();
    this.sub('*currentActivity', (val) => {
      if (val === BlockComponent.activities.CLOUD_IMG_EDIT) {
        this.mountEditor();
      } else {
        this.unmountEditor();
      }
    });

    this.sub('*focusedEntry', (/** @type {import('@symbiotejs/symbiote').TypedData} */ entry) => {
      if (!entry) {
        return;
      }
      this.entry = entry;

      this.entry.subscribe('uuid', (uuid) => {
        if (uuid) {
          this.$.uuid = uuid;
        }
      });
    });
  }

  handleApply(e) {
    let result = e.detail;
    let { transformationsUrl } = result;
    this.entry.setValue('transformationsUrl', transformationsUrl);
    this.historyBack();
  }

  handleCancel() {
    this.historyBack();
  }

  mountEditor() {
    let editorClass = window.customElements.get('uc-editor');
    let instance = new editorClass();

    let uuid = this.$.uuid;
    let publicKey = this.$['*--cfg-pubkey'];
    instance.setAttribute('uuid', uuid);
    instance.setAttribute('public-key', publicKey);

    instance.addEventListener('apply', (result) => this.handleApply(result));
    instance.addEventListener('cancel', () => this.handleCancel());

    this.innerHTML = '';
    this.style.width = '600px';
    this.style.height = '400px';
    this.appendChild(instance);
  }

  unmountEditor() {
    this.style.width = '0px';
    this.style.height = '0px';
    this.innerHTML = '';
  }
}
