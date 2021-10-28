import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { FileItem } from '../FileItem/FileItem.js';
import { UiConfirmation } from '../ConfirmationDialog/ConfirmationDialog.js';
import { ActivityComponent } from '../ActivityComponent/ActivityComponent.js';

export class UploadList extends ActivityComponent {
  activityType = BlockComponent.activities.UPLOAD_LIST;

  init$ = {
    uploadBtnDisabled: false,
    moreBtnDisabled: !this.config.MULTIPLE,
    onAdd: () => {
      this.$['*currentActivity'] = BlockComponent.activities.SOURSE_SELECT;
    },
    onUpload: () => {
      this.set$({
        uploadBtnDisabled: true,
        '*uploadTrigger': {},
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
      let notUploaded = this.uploadCollection.findItems((item) => {
        return !item.getValue('uuid');
      });
      this.$.uploadBtnDisabled = !notUploaded.length;
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
    set="onclick: onCancel;"
    l10n="cancel"></button>
  <div></div>
  <button
    .add-more-btn
    set="onclick: onAdd; @disabled: moreBtnDisabled"
    l10n="add-more"></button>
  <button
    .upload-btn
    set="onclick: onUpload; @disabled: uploadBtnDisabled"
    l10n="upload"></button>
</div>
`;
