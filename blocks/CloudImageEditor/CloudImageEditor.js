import { Block } from '../../abstract/Block.js';
import { CloudEditor } from './index.js';

export class CloudImageEditor extends Block {
  activityType = Block.activities.CLOUD_IMG_EDIT;

  init$ = {
    uuid: null,
  };

  initCallback() {
    this.bindCssData('--cfg-pubkey');

    this.sub('*currentActivity', (val) => {
      if (val === Block.activities.CLOUD_IMG_EDIT) {
        this.mountEditor();
      } else {
        this.unmountEditor();
      }
    });

    this.sub('*focusedEntry', (/** @type {import('../../submodules/symbiote/core/symbiote.js').TypedData} */ entry) => {
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

  /** @param {CustomEvent<import('./src/types.js').ApplyResult>} e */
  handleApply(e) {
    let result = e.detail;
    this.entry.setMultipleValues({
      cdnUrl: result.cdnUrl,
      cdnUrlModifiers: result.cdnUrlModifiers,
      editorTransformations: result.transformations
    })
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
    this.appendChild(instance);
  }

  unmountEditor() {
    this.innerHTML = '';
  }
}
