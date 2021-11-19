import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { FileItem } from '../FileItem/FileItem.js';
import { UiConfirmation } from '../ConfirmationDialog/ConfirmationDialog.js';
import { ActivityComponent } from '../ActivityComponent/ActivityComponent.js';

export class UploadList extends ActivityComponent {
  activityType = BlockComponent.activities.UPLOAD_LIST;

  init$ = {
    doneBtnHidden: true,
    uploadBtnHidden: false,
    uploadBtnDisabled: false,
    moreBtnDisabled: !this.config.MULTIPLE,
    onAdd: () => {
      this.$['*currentActivity'] = BlockComponent.activities.SOURCE_SELECT;
    },
    onUpload: () => {
      this.set$({
        '*uploadTrigger': {},
      });
    },
    onDone: () => {
      this.set$({
        '*currentActivity': '',
      });
      this.output();
    },
    onCancel: () => {
      let cfn = new UiConfirmation();
      cfn.confirmAction = () => {
        this.$['*currentActivity'] = '';
        this.uploadCollection.clearAll();
      };
      cfn.denyAction = () => {
        this.historyBack();
      };
      this.$['*confirmation'] = cfn;
    },
  };

  _renderMap = Object.create(null);

  onActivate() {
    super.onActivate();

    this.set$({
      '*modalCaption': this.l10n('selected'),
      '*modalIcon': 'local',
    });
  }

  initCallback() {
    super.initCallback();

    this.uploadCollection.observe(() => {
      //TODO: probably we need to optimize it, too many iterations and allocations just to calc uploaded files
      let notUploaded = this.uploadCollection.findItems((item) => {
        return !item.getValue('uuid');
      });
      let inProgress = this.uploadCollection.findItems((item) => {
        return !item.getValue('uuid') && item.getValue('uploadProgress') > 0;
      });

      let everythingUploaded = notUploaded.length === 0;
      let somethingUploading = inProgress.length > 0;
      this.set$({
        uploadBtnHidden: everythingUploaded,
        uploadBtnDisabled: somethingUploading,
        doneBtnHidden: !everythingUploaded,
      });
    });
    this.sub('*uploadList', (/** @type {String[]} */ list) => {
      if (!list.length) {
        this.$['*currentActivity'] = '';
        return;
      }
      list.forEach((id) => {
        if (!this._renderMap[id]) {
          let item = new FileItem();
          this._renderMap[id] = item;
        }
      });

      for (let id in this._renderMap) {
        if (!list.includes(id)) {
          this._renderMap[id].remove();
          delete this._renderMap[id];
        }
      }

      let fr = document.createDocumentFragment();
      Object.values(this._renderMap).forEach((el) => fr.appendChild(el));
      this.ref.files.replaceChildren(fr);
      Object.entries(this._renderMap).forEach(([id, el]) => {
        // rendering components async improves initial list render time a bit
        setTimeout(() => {
          el['entry-id'] = id;
          el.render();
        });
      });
    });
  }
}

UploadList.template = /*html*/ `
<div .files ref="files"></div>
<div .toolbar>
  <button
    .cancel-btn
    .secondary-btn
    set="onclick: onCancel;"
    l10n="clear"></button>
  <div></div>
  <button
    .add-more-btn
    .secondary-btn
    set="onclick: onAdd; @disabled: moreBtnDisabled"
    l10n="add-more"></button>
  <button
    .upload-btn
    .primary-btn
    set="@hidden: uploadBtnHidden; onclick: onUpload; @disabled: uploadBtnDisabled"
    l10n="upload"></button>
    <button
    .done-btn
    .primary-btn
    set="@hidden: doneBtnHidden; onclick: onDone"
    l10n="done"></button>
</div>
`;
