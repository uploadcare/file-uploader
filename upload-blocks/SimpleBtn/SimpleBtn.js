import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class SimpleBtn extends BlockComponent {

  initCallback() {
    this.sub('external', 'uploadList', (/** @type {String[]} */ list) => {
      this._length = list.length;
    });

    this.onclick = () => {
      if (this._length) {
        this.multiPub('external', {
          currentActivity: 'upload-list',
          modalActive: true,
        });
      } else {
        this.multiPub('external', {
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
  <span l10n="upload-files"></span>
</button>`;