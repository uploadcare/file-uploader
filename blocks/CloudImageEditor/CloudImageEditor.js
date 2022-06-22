import { Block } from '../../abstract/Block.js';
import { CloudEditor } from './index.js';

/**
 * @typedef {{
 *   uuid: String;
 * }} State
 */

/** @extends {Block<State>} */
export class CloudImageEditor extends Block {
  activityType = Block.activities.CLOUD_IMG_EDIT;

  /** @type {State} */
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

  /** @param {CustomEvent<import('./src/types.js').ApplyResult>} e */
  handleApply(e) {
    let result = e.detail;
    this.entry.setMultipleValues({
      cdnUrl: result.cdnUrl,
      cdnUrlModifiers: result.cdnUrlModifiers,
      editorTransformations: result.transformations,
    });
    this.historyBack();
  }

  handleCancel() {
    this.historyBack();
  }

  mountEditor() {
    let instance = new CloudEditor();
    instance.classList.add('lr-cldtr-common');
    let uuid = this.$.uuid;
    // let publicKey = this.getCssData('--cfg-pubkey');
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
