import { Block } from '../../abstract/Block.js';
import { stringToArray } from '../../utils/stringToArray.js';

export class SourceList extends Block {
  initCallback() {
    super.initCallback();
    this.subConfigValue('sourceList', (/** @type {String} */ val) => {
      let list = stringToArray(val);
      let html = '';
      list.forEach((srcName) => {
        html += /* HTML */ `<lr-source-btn type="${srcName}"></lr-source-btn>`;
      });
      if (this.cfg.sourceListWrap) {
        this.innerHTML = html;
      } else {
        this.outerHTML = html;
      }
    });
  }
}
