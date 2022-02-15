import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { fileCssBg } from '../svg-backgrounds/svg-backgrounds.js';

export class UploadDetails extends BlockComponent {
  activityType = BlockComponent.activities.DETAILS;

  init$ = {
    checkerboard: false,
    localImageEditDisabled: true,
    fileSize: null,
    fileName: '',
    notUploaded: true,
    cdnUrl: '',
    errorTxt: '',
    editBtnHidden: true,
    onNameInput: null,
    '*focusedEntry': null,
    onBack: () => {
      this.historyBack();
    },
    onRemove: () => {
      /** @type {File[]} */
      this.uploadCollection.remove(this.entry.uid);
      this.historyBack();
    },
    onEdit: () => {
      if (this.entry.getValue('uuid')) {
        this.$['*currentActivity'] = BlockComponent.activities.CLOUD_IMG_EDIT;
      }
    },
  };

  showNonImageThumb() {
    let color = window.getComputedStyle(this).getPropertyValue('--clr-generic-file-icon');
    let url = fileCssBg(color, 108, 108);
    this.eCanvas.setImageUrl(url);
    this.set$({
      checkerboard: false,
    });
  }

  initCallback() {
    this.bindCssData('--cfg-use-local-image-editor');
    this.sub('*--cfg-use-local-image-editor', (val) => {
      this.set$({
        localImageEditDisabled: !val,
      });
    });
    this.$.fileSize = this.l10n('file-size-unknown');
    this.registerActivity(this.activityType, () => {
      this.set$({
        '*activityCaption': this.l10n('caption-edit-file'),
      });
    });
    // this.sub('editBtnHidden', (val) => {
    //   this.$.localImageEditDisabled = !!val;
    // });
    /** @type {import('../EditableCanvas/EditableCanvas.js').EditableCanvas} */
    // @ts-ignore
    this.eCanvas = this.ref.canvas;
    this.sub('*focusedEntry', (/** @type {import('@symbiotejs/symbiote').TypedData} */ entry) => {
      if (!entry) {
        return;
      }
      if (this._entrySubs) {
        this._entrySubs.forEach((sub) => {
          this._entrySubs.delete(sub);
          sub.remove();
        });
      } else {
        /** @private */
        this._entrySubs = new Set();
      }
      this.entry = entry;
      /** @type {File} */
      let file = entry.getValue('file');
      this.eCanvas.clear();
      if (file) {
        /**
         * @private
         * @type {File}
         */
        this._file = file;
        let isImage = this._file.type.includes('image');
        if (isImage && !entry.getValue('transformationsUrl')) {
          this.eCanvas.setImageFile(this._file);
          this.set$({
            checkerboard: true,
            editBtnHidden: !this.$['*--cfg-use-local-image-editor'] && !this.$['*--cfg-use-cloud-image-editor'],
          });
        }
        if (!isImage) {
          this.showNonImageThumb();
        }
      }
      let tmpSub = (prop, callback) => {
        this._entrySubs.add(this.entry.subscribe(prop, callback));
      };
      tmpSub('fileName', (name) => {
        this.$.fileName = name;
        this.$.onNameInput = () => {
          let name = this.ref.file_name_input['value'];
          Object.defineProperty(this._file, 'name', {
            writable: true,
            value: name,
          });
          this.entry.setValue('fileName', name);
        };
      });
      tmpSub('fileSize', (size) => {
        this.$.fileSize = Number.isFinite(size) ? this.fileSizeFmt(size) : this.l10n('file-size-unknown');
      });
      tmpSub('uuid', (uuid) => {
        if (uuid) {
          this.eCanvas.clear();
          this.set$({
            cdnUrl: `https://ucarecdn.com/${uuid}/`,
            notUploaded: false,
          });
          this.eCanvas.setImageUrl(this.$.cdnUrl);
        } else {
          this.$.cdnUrl = 'Not uploaded yet...';
        }
      });
      tmpSub('uploadError', (error) => {
        this.$.errorTxt = error?.message;
      });

      tmpSub('externalUrl', (url) => {
        if (!url) {
          return;
        }
        if (!this.entry.getValue('uuid')) {
          this.showNonImageThumb();
        }
      });
      tmpSub('transformationsUrl', (url) => {
        if (!url) {
          return;
        }
        if (this.entry.getValue('isImage')) {
          this.eCanvas.setImageUrl(url);
        }
      });
    });
  }
}

UploadDetails.template = /*html*/ `
<uc-tabs
  tab-list="tab-view, tab-details">

  <div
    tab-ctx="tab-details"
    class="details">

    <div class="info-block">
      <div class="info-block_name" l10n="file-name"></div>
      <input
        name="name-input"
        ref="file_name_input"
        set="value: fileName; oninput: onNameInput"
        type="text" />
    </div>

    <div class="info-block">
      <div class="info-block_name" l10n="file-size"></div>
      <div>{{fileSize}}</div>
    </div>

    <div class="info-block">
      <div class="info-block_name" l10n="cdn-url"></div>
      <a
        target="_blank"
        set="@href: cdnUrl; @disabled: notUploaded">{{cdnUrl}}</a>
    </div>

    <div>{{errorTxt}}</div>

  </div>

  <uc-editable-canvas
    tab-ctx="tab-view"
    set="@disabled: localImageEditDisabled; @checkerboard: checkerboard;"
    ref="canvas">
  </uc-editable-canvas>
</uc-tabs>

<div class="toolbar" set="@edit-disabled: editBtnHidden">
  <button
    class="edit-btn secondary-btn"
    set="onclick: onEdit; @hidden: editBtnHidden;">
    <uc-icon name="edit"></uc-icon>
    <span l10n="edit-image"></span>
  </button>
  <button
    class="remove-btn secondary-btn"
    set="onclick: onRemove">
    <uc-icon name="remove"></uc-icon>
    <span l10n="remove-from-list"></span>
  </button>
  <div></div>
  <button
    class="back-btn primary-btn"
    set="onclick: onBack">
    <span l10n="done"></span>
  </button>
</div>
`;
