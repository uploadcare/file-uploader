import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { createCdnUrl, createCdnUrlModifiers, createOriginalUrl } from '../../utils/cdn-utils.js';
import { fileCssBg } from '../svg-backgrounds/svg-backgrounds.js';

export class UploadDetails extends UploaderBlock {
  activityType = ActivityBlock.activities.DETAILS;

  pauseRender = true;

  init$ = {
    ...this.init$,
    checkerboard: false,
    fileSize: null,
    fileName: '',
    cdnUrl: '',
    errorTxt: '',
    cloudEditBtnHidden: true,
    onNameInput: null,
    onBack: () => {
      this.historyBack();
    },
    onRemove: () => {
      /** @type {File[]} */
      this.uploadCollection.remove(this.entry.uid);
      this.historyBack();
    },
    onCloudEdit: () => {
      if (this.entry.getValue('uuid')) {
        this.$['*currentActivity'] = ActivityBlock.activities.CLOUD_IMG_EDIT;
      }
    },
  };

  cssInit$ = {
    '--cfg-use-cloud-image-editor': 0,
    '--cfg-use-local-image-editor': 0,
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
    super.initCallback();
    // Rendering is postponed for the CSS-context-properties usage in template:
    this.render();
    this.$.fileSize = this.l10n('file-size-unknown');
    this.registerActivity(this.activityType, () => {
      this.set$({
        '*activityCaption': this.l10n('caption-edit-file'),
      });
    });
    /** @type {import('../EditableCanvas/EditableCanvas.js').EditableCanvas} */
    // @ts-ignore
    this.eCanvas = this.ref.canvas;
    this.sub('*focusedEntry', (/** @type {import('../../abstract/TypedData.js').TypedData} */ entry) => {
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
        if (isImage && !entry.getValue('cdnUrl')) {
          this.eCanvas.setImageFile(this._file);
          this.set$({
            checkerboard: true,
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
          let value = this.ref.file_name_input['value'];
          Object.defineProperty(this._file, 'name', {
            writable: true,
            value: value,
          });
          this.entry.setValue('fileName', value);
        };
      });
      tmpSub('fileSize', (size) => {
        this.$.fileSize = Number.isFinite(size) ? this.fileSizeFmt(size) : this.l10n('file-size-unknown');
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
      tmpSub('cdnUrl', (cdnUrl) => {
        const canUseCloudEditor = this.$['--cfg-use-cloud-image-editor'] && cdnUrl && this.entry.getValue('isImage');

        this.eCanvas.clear();
        this.set$({
          cdnUrl,
          cloudEditBtnHidden: !canUseCloudEditor,
        });
        if (cdnUrl && this.entry.getValue('isImage')) {
          // TODO: need to resize image to fit the canvas size
          let imageUrl = createCdnUrl(cdnUrl, createCdnUrlModifiers('format/auto', 'preview'));
          this.eCanvas.setImageUrl(this.proxyUrl(imageUrl));
        }
      });
    });
  }
}

UploadDetails.template = /*html*/ `
<lr-tabs
  tab-list="tab-view, tab-details">

  <div
    tab-ctx="tab-details"
    class="details">

    <div class="info-block">
      <div class="info-block_name" l10n="file-name"></div>
      <input
        name="name-input"
        ref="file_name_input"
        set="value: fileName; oninput: onNameInput; @disabled: !!cdnUrl"
        type="text" />
    </div>

    <div class="info-block">
      <div class="info-block_name" l10n="file-size"></div>
      <div>{{fileSize}}</div>
    </div>

    <div class="info-block">
      <div class="info-block_name" l10n="cdn-url"></div>
      <a
        class="cdn-link"
        target="_blank"
        set="@href: cdnUrl; @disabled: !cdnUrl">{{cdnUrl}}</a>
    </div>

    <div>{{errorTxt}}</div>

  </div>

  <lr-editable-canvas
    tab-ctx="tab-view"
    set="@disabled: !--cfg-use-local-image-editor; @checkerboard: checkerboard;"
    ref="canvas">
  </lr-editable-canvas>
</lr-tabs>

<div class="toolbar" set="@edit-disabled: cloudEditBtnHidden">
  <button
    type="button"
    class="edit-btn secondary-btn"
    set="onclick: onCloudEdit; @hidden: cloudEditBtnHidden;">
    <lr-icon name="edit"></lr-icon>
    <span l10n="edit-image"></span>
  </button>
  <button
    type="button"
    class="remove-btn secondary-btn"
    set="onclick: onRemove">
    <lr-icon name="remove"></lr-icon>
    <span l10n="remove-from-list"></span>
  </button>
  <div></div>
  <button
    type="button"
    class="back-btn primary-btn"
    set="onclick: onBack">
    <span l10n="ok"></span>
  </button>
</div>
`;
