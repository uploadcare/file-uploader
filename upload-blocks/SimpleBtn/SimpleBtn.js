import { BaseComponent } from '../../symbiote/core/BaseComponent.js';

export class SimpleBtn extends BaseComponent {

  initCallback() {
    this.externalState.sub('uploadList', (/** @type {String[]} */ list) => {
      this._length = list.length;
    });
    this.onclick = () => {
      if (this._length) {
        this.externalState.multiPub({
          currentActivity: 'upload-list',
          modalActive: true,
        });
      } else {
        this.externalState.multiPub({
          currentActivity: 'source-select',
          modalCaption: 'Select File Source',
          modalActive: true,
        });
      }
    };
  }
}

SimpleBtn.template = /*html*/ `
<button>
  <icon-ui name="upload"></icon-ui>
</button>`;