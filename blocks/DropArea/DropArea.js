import { Block } from '../../abstract/Block.js';
import { DropzoneState, addDropzone } from './addDropzone.js';

export class DropArea extends Block {
  init$ = {
    state: DropzoneState.INACTIVE,
  };
  initCallback() {
    /** @private */
    this._destroyDropzone = addDropzone({
      element: this,
      onChange: (state) => {
        this.$.state = state;
      },
      onFiles: (files) => {
        files.forEach((/** @type {File} */ file) => {
          this.uploadCollection.add({
            file,
            isImage: file.type.includes('image'),
            mimeType: file.type,
            fileName: file.name,
            fileSize: file.size,
          });
        });
        this.set$({
          '*currentActivity': Block.activities.UPLOAD_LIST,
        });
      },
    });

    this.sub('state', (state) => {
      const stateText = Object.entries(DropzoneState)
        .find(([, value]) => value === state)?.[0]
        .toLowerCase();
      if (stateText) {
        this.setAttribute('drag-state', stateText);
      }
    });
  }

  destroyCallback() {
    this._destroyDropzone?.();
  }
}
