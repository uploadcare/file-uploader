import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { FileItem } from '../FileItem/FileItem.js';
import { UiConfirmation } from '../ConfirmationDialog/ConfirmationDialog.js';
import { ActivityComponent } from '../ActivityComponent/ActivityComponent.js';

export class UploadList extends ActivityComponent {
  activityType = BlockComponent.activities.UPLOAD_LIST;

  init$ = {
    doneBtnVisible: false,
    uploadBtnVisible: true,
    uploadBtnDisabled: false,
    moreBtnDisabled: !this.config.MULTIPLE,
    onAdd: () => {
      this.$['*currentActivity'] = BlockComponent.activities.SOURSE_SELECT;
    },
    onUpload: () => {
      this.set$({
        '*uploadTrigger': {},
      });
    },
    onDone: () => {
      this.set$({
        '*modalActive': false,
      });
    },
    onCancel: () => {
      let cfn = new UiConfirmation();
      cfn.confirmAction = () => {
        this.$['*modalActive'] = false;
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
    let modalActive = true;
    if (this.activityParams.openSystemDialog && !this.$['*files']?.length) {
      modalActive = false;
      this.openSystemDialog();
    }

    this.set$({
      '*modalCaption': this.l10n('selected'),
      '*modalIcon': 'local',
      '*modalActive': modalActive,
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
        uploadBtnVisible: !everythingUploaded,
        uploadBtnDisabled: somethingUploading,
        doneBtnVisible: everythingUploaded,
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
          this.ref.files.prepend(item);
          item['entry-id'] = id;
          this._renderMap[id] = item;
        }
        for (let id in this._renderMap) {
          if (!list.includes(id)) {
            this._renderMap[id].remove();
            delete this._renderMap[id];
          }
        }
      });
    });
  }
}

UploadList.template = /*html*/ `
<div .files ref="files"></div>
<div .toolbar>
  <button
    .cancel-btn
    set="onclick: onCancel;"
    l10n="cancel"></button>
  <div></div>
  <button
    .add-more-btn
    set="onclick: onAdd; @disabled: moreBtnDisabled"
    l10n="add-more"></button>
  <button
    .upload-btn
    if="uploadBtnVisible"
    set="onclick: onUpload; @disabled: uploadBtnDisabled"
    l10n="upload"></button>
    <button
    .done-btn
    if="doneBtnVisible"
    set="onclick: onDone"
    l10n="done"></button>
</div>
`;
