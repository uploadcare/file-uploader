import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class UploadResult extends BlockComponent {
  initCallback() {
    this.render();
    this.addToExternalState({
      uploadOutput: [],
    });
    this.sub('external', 'uploadOutput', (/** @type {String[]} */ outArr) => {
      this.ref.out.innerHTML = '';
      this.pub('external', 'modalCaption', 'Uploaded');
      outArr.forEach((cdnUrl) => {
        let urlDiv = document.createElement('cdn-item');
        urlDiv.textContent = cdnUrl;
        this.ref.out.appendChild(urlDiv);
      });
    });
  }
}
UploadResult.template = /*html*/ `
<div ref="out"></div>
`;
