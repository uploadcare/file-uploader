import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { DropzoneState, addDropzone } from './addDropzone.js';
import { UiMessage } from '../MessageBox/MessageBox.js';

export class DropArea extends UploaderBlock {
  init$ = {
    ...this.ctxInit,
    state: DropzoneState.INACTIVE,
  };
  initCallback() {
    super.initCallback();
    /** @private */
    this._destroyDropzone = addDropzone({
      element: this,
      onChange: (state) => {
        this.$.state = state;
      },
      onFiles: (files) => {
        if (!files.length) {
          return;
        }
        if (!this.getCssData('--cfg-multiple')) {
          files = [files[0]];
        }
        files.forEach((/** @type {File} */ file) => {
          let hasValidationErrors = false;
          let isImage = file.type.includes('image');
          // This solution doesn't check --cfg-accept setting.
          // TODO: Needs to be improved in future.
          if (this.getCssData('--cfg-img-only') && !isImage) {
            hasValidationErrors = true;
          } else {
            this.uploadCollection.add({
              file,
              isImage: isImage,
              mimeType: file.type,
              fileName: file.name,
              fileSize: file.size,
            });
          }
          if (hasValidationErrors) {
            let msg = new UiMessage();
            msg.caption = 'Error';
            msg.text = this.l10n('has-validation-errors');
            msg.isError = true;
            this.$['*message'] = msg;
          }
        });
        this.set$({
          '*currentActivity': ActivityBlock.activities.UPLOAD_LIST,
        });
      },
      onImgElement(src) {
        // @ts-ignore
        this.uploadCollection.add({
          externalUrl: src,
        });
        // @ts-ignore
        this.set$({
          '*currentActivity': ActivityBlock.activities.UPLOAD_LIST,
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

    if (this.hasAttribute('clickable')) {
      let clickable = this.getAttribute('clickable');
      if (clickable === '' || clickable === 'true') {
        // @private
        this._onAreaClicked = () => {
          this.openSystemDialog();
        };
        this.addEventListener('click', this._onAreaClicked);
      }
    }
  }

  destroyCallback() {
    super.destroyCallback();
    this._destroyDropzone?.();
    if (this._onAreaClicked) {
      this.removeEventListener('click', this._onAreaClicked);
    }
  }
}
