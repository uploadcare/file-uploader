import { AppComponent } from '../AppComponent/AppComponent.js';

export class UploadResult extends AppComponent {
  connectedCallback() {
    super.connectedCallback();
    this.render();
    this.addToAppState({
      uploadOutput: [],
    });
    this.appState.sub('uploadOutput', (/** @type {String[]} */ outArr) => {
      this.ref.out.innerHTML = '';
      this.appState.pub('modalCaption', 'Uploaded');
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
