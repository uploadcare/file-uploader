import { Block } from '../../abstract/Block.js';
import { stringToArray } from '../../utils/stringToArray.js';

export class SourceList extends Block {
  cssInit$ = {
    '--cfg-source-list': '',
  };

  initCallback() {
    super.initCallback();
    this.sub('--cfg-source-list', (/** @type {String} */ val) => {
      if (!val) {
        return;
      }
      let list = stringToArray(val);
      let html = '';
      list.forEach((srcName) => {
        html += /* HTML */ `<lr-source-btn type="${srcName}"></lr-source-btn>`;
      });
      if (this.getCssData('--cfg-source-list-wrap')) {
        this.innerHTML = html;
      } else {
        this.outerHTML = html;
      }
    });
  }
}
