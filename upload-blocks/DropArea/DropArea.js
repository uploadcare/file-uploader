import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class DropArea extends BlockComponent {

  initCallback() {
    this.addEventListener('dragover', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    this.addEventListener('drop', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.dataTransfer.files) {
        [...e.dataTransfer.files].forEach((/** @type {File} */ file) => {
          this.uploadCollection.add({
            file,
            isImage: file.type.includes('image'),
            mimeType: file.type,
            fileName: file.name,
            fileSize: file.size,
          });
        });
        this.multiPub('external', {
          currentActivity: 'upload-list',
          modalActive: true,
        });
      }
    }, false);
  }

}

DropArea.template = /*html*/ `
<div .sources>
  <slot></slot>
</div>
<div .dropzone>
  <div .drop-txt l10n="drop-files-here"></div>
  <div .powered>Powered by Uploadcare ©</div>
</div>
`;