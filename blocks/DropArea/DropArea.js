import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { DropzoneState, addDropzone } from './addDropzone.js';
import { fileIsImage } from '../../utils/fileTypes.js';
import { Modal } from '../Modal/Modal.js';

export class DropArea extends UploaderBlock {
  init$ = {
    ...this.ctxInit,
    state: DropzoneState.INACTIVE,
    withIcon: false,
    isClickable: false,
    text: this.l10n('drop-files-here'),
  };
  initCallback() {
    super.initCallback();

    this.defineAccessor('clickable', (value) => {
      this.set$({ isClickable: typeof value === 'string' });
    });
    this.defineAccessor('with-icon', (value) => {
      this.set$({ withIcon: typeof value === 'string' });
    });
    this.defineAccessor('text', (value) => {
      if (value) {
        this.set$({ text: this.l10n(value) || value });
      } else {
        this.set$({ text: this.l10n('drop-files-here') });
      }
    });

    /** @private */
    this._destroyDropzone = addDropzone({
      element: this,
      onChange: (state) => {
        this.$.state = state;
      },
      onItems: (items) => {
        if (!items.length) {
          return;
        }
        if (!this.getCssData('--cfg-multiple')) {
          items = [items[0]];
        }
        items.forEach((/** @type {File | String} */ item) => {
          if (typeof item === 'string') {
            this.uploadCollection.add({
              externalUrl: item,
            });
            return;
          }
          let isImage = fileIsImage(item);
          this.uploadCollection.add({
            file: item,
            isImage: isImage,
            mimeType: item.type,
            fileName: item.name,
            fileSize: item.size,
          });
        });
        if (this.uploadCollection.size) {
          this.set$({
            '*currentActivity': ActivityBlock.activities.UPLOAD_LIST,
          });
          this.setForCtxTarget(Modal.StateConsumerScope, '*modalActive', true);
        }
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

    if (this.$.isClickable) {
      // @private
      this._onAreaClicked = () => {
        this.openSystemDialog();
      };
      this.addEventListener('click', this._onAreaClicked);
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

DropArea.template = /* HTML */ `
  <slot>
    <div class="content-wrapper">
      <div class="icon-container" set="@hidden: !withIcon">
        <lr-icon name="default"></lr-icon>
        <lr-icon name="arrow-down"></lr-icon>
      </div>
      <span class="text">{{text}}</span>
    </div>
  </slot>
`;

DropArea.bindAttributes({
  'with-icon': null,
  clickable: null,
  text: null,
});
