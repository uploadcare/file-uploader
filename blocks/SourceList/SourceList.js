import { Block } from '../../abstract/Block.js';
import { stringToArray } from '../../utils/stringToArray.js';
import { UploadSource } from '../utils/UploadSource.js';

export class SourceList extends Block {
  initCallback() {
    super.initCallback();
    this.subConfigValue('sourceList', (/** @type {String} */ val) => {
      let list = stringToArray(val);
      let html = '';
      list.forEach((srcName) => {
        if (!Object.values(UploadSource).includes(srcName)) {
          console.error(`Source "${srcName}" not found in UploadSource`);
          return;
        }

        html += /* HTML */ `<uc-source-btn type="${srcName}"></uc-source-btn>`;
      });

      if (this.cfg.sourceListWrap) {
        this.innerHTML = html;
      } else {
        this.outerHTML = html;
      }
    });
  }
}
