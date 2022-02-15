import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class SourceList extends BlockComponent {
  initCallback() {
    this.bindCssData('--cfg-source-list');
    this.sub('*--cfg-source-list', (val) => {
      if (!val) {
        return;
      }
      let list = val.split(',').map((srcName) => {
        return srcName.trim();
      });
      let html = '';
      list.forEach((srcName) => {
        html += /*html*/ `<uc-source-btn type="${srcName}"></uc-source-btn>`;
      });
      if (this.hasAttribute('wrap')) {
        this.innerHTML = html;
      } else {
        this.outerHTML = html;
      }
    });
  }
}
