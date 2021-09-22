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
          modalCaption: this.l10n('select-file-source'),
          modalActive: true,
        });
      }
    };
  }
}

SimpleBtn.template = /*html*/ `
<button>
  <uc-icon name="upload"></uc-icon>
  <span l10n="upload-files"></span>
</button>`;
