import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class DataOutput extends BlockComponent {
  initCallback() {
    let from = this.getAttribute('from');
    this.sub(
      from || DataOutput.defaultFrom,
      (/** @type {import('@uploadcare/upload-client').UploadcareFile[]} */ data) => {
        if (!data) {
          this.innerHTML = '';
          return;
        }
        if (this.hasAttribute(DataOutput.fireEventAttrName)) {
          this.dispatchEvent(
            new CustomEvent(DataOutput.outputEventName, {
              bubbles: true,
              composed: true,
              detail: {
                timestamp: Date.now(),
                ctxName: this.ctxName,
                data,
              },
            })
          );
        }
        if (this.hasAttribute(DataOutput.templateAttrName)) {
          let tpl = this.getAttribute(DataOutput.templateAttrName);
          let html = '';
          data.forEach((fileItem) => {
            let itemHtml = tpl;
            for (let prop in fileItem) {
              itemHtml = itemHtml.split(`{{${prop}}}`).join(fileItem[prop]);
            }
            html += itemHtml;
          });
          this.innerHTML = html;
        }
        this.value = data;
        if (this.hasAttribute(DataOutput.formValueAttrName)) {
          if (!this._input) {
            /** @private */
            this._input = document.createElement('input');
            this._input.type = 'text';
            this.appendChild(this._input);
          }
          this._input.value = JSON.stringify(data);
        }
        if (this.hasAttribute(DataOutput.consoleAttrName)) {
          console.log(data);
        }
      }
    );
  }
}

DataOutput.outputEventName = 'data-output';
DataOutput.templateAttrName = 'item-template';
DataOutput.fireEventAttrName = 'fire-event';
DataOutput.consoleAttrName = 'console';
DataOutput.formValueAttrName = 'form-value';
DataOutput.defaultFrom = '*outputData';
