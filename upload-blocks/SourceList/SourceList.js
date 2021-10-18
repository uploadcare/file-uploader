import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class SourceList extends BlockComponent {
  initCallback() {
    let list = this.config.SRC_LIST.split(',').map((srcName) => {
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
  }
}
