import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { CloudEditor } from '@uploadcare/cloud-editor';

export class CloudImageEditor extends BlockComponent {
  activityType = BlockComponent.activities.CLOUD_IMG_EDIT;

  init$ = {
    uuid: null,
  };

  initCallback() {
    this.style.display = 'flex';
    this.style.position = 'relative';

    this.bindCssData('--cfg-pubkey');

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
    let instance = new CloudEditor();
    instance.classList.add('uc-cldtr-common');
    let uuid = this.$.uuid;
    // let publicKey = this.$['*--cfg-pubkey'];
    instance.setAttribute('uuid', uuid);
    // instance.setAttribute('public-key', publicKey);

    instance.addEventListener('apply', (result) => this.handleApply(result));
    instance.addEventListener('cancel', () => this.handleCancel());

    this.innerHTML = '';
    this.style.width = '100%';
    this.style.height = '100%';
    this.appendChild(instance);
  }

  unmountEditor() {
    this.style.width = '0px';
    this.style.height = '0px';
    this.innerHTML = '';
  }
}
