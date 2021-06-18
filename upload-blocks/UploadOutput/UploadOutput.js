import { AppComponent } from '../AppComponent/AppComponent.js';

export class UploadOutput extends AppComponent {
  connectedCallback() {
    super.connectedCallback();
    this.render();
    this.addToAppState({
      uploadOutput: [],
    });
    this.appState.sub('uploadOutput', (/** @type {String[]} */ outArr) => {
      this.refs.out.innerHTML = '';
      outArr.forEach((cdnUrl) => {
        let urlDiv = document.createElement('div');
        urlDiv.textContent = cdnUrl;
        this.refs.out.appendChild(urlDiv);
      });
    });
  }
}
UploadOutput.template = /*html*/ `
<div ref="out"></div>
`;
