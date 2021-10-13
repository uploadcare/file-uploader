import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class SourceBtn extends BlockComponent {
  init$ = {
    iconName: 'default',
  };

  initCallback() {
    this.setAttribute('role', 'button');
    this.defineAccessor('type', (val) => {
      if (!val) {
        return;
      }
      this._setType(val);
    });
  }

  _setType(type) {
    let externalType = (type) => ({
      [type]: () => {
        this.applyL10nKey('src-type', `src-type-${type}`);
        this.$.iconName = type;
        this.onclick = () => {
          this.set$({
            '*externalSourceType': type,
            '*currentActivity': BlockComponent.activities.EXTERNAL,
            '*modalCaption': `${type[0].toUpperCase()}${type.slice(1)}`,
            '*modalIcon': type,
            '*modalActive': true,
          });
        };
      },
    });

    let types = {
      local: () => {
        this.applyL10nKey('src-type', 'src-type-local');
        this.$.iconName = 'local';
        this.onclick = () => {
          this.set$({
            '*modalActive': false,
            '*currentActivity': BlockComponent.activities.UPLOAD_LIST,
            '*modalCaption': this.l10n('selected'),
            '*modalIcon': 'local',
          });
          if (!this.$['*files']?.length) {
            this.openSystemDialog();
          } else {
            this.$['*modalActive'] = true;
          }
        };
      },
      url: () => {
        this.applyL10nKey('src-type', 'src-type-from-url');
        this.$.iconName = 'url';
        this.onclick = () => {
          this.set$({
            '*currentActivity': BlockComponent.activities.URL,
            '*modalCaption': this.l10n('caption-from-url'),
            '*modalIcon': 'url',
            '*modalActive': true,
          });
        };
      },
      camera: () => {
        this.applyL10nKey('src-type', 'src-type-camera');
        this.$.iconName = 'camera';
        this.onclick = () => {
          this.set$({
            '*currentActivity': BlockComponent.activities.CAMERA,
            '*modalCaption': this.l10n('caption-camera'),
            '*modalIcon': 'camera',
            '*modalActive': true,
          });
        };
      },
      draw: () => {
        this.applyL10nKey('src-type', 'src-type-draw');
        this.$.iconName = 'edit-draw';
        this.onclick = () => {
          this.set$({
            '*currentActivity': BlockComponent.activities.DRAW,
            '*modalCaption': this.l10n('caption-draw'),
            '*modalIcon': 'edit-draw',
            '*modalActive': true,
          });
        };
      },
      // other: () => {
      //   this.applyL10nKey('src-type', 'src-type-other');
      //   this.$.iconName = 'dots';
      //   this.onclick = () => {
      //     this.set$({
      //       '*currentActivity': 'external',
      //       '*modalCaption': 'Other sources',
      //       '*modalIcon': 'dots',
      //       '*modalActive': true,
      //     });
      //   };
      // },
      ...externalType(BlockComponent.extSrcList.INSTAGRAM),
      ...externalType(BlockComponent.extSrcList.FACEBOOK),
      ...externalType(BlockComponent.extSrcList.DROPBOX),
      ...externalType(BlockComponent.extSrcList.GDRIVE),
      ...externalType(BlockComponent.extSrcList.GPHOTOS),
      ...externalType(BlockComponent.extSrcList.INSTAGRAM),
      ...externalType(BlockComponent.extSrcList.FLICKR),
      ...externalType(BlockComponent.extSrcList.VK),
      ...externalType(BlockComponent.extSrcList.EVERNOTE),
      ...externalType(BlockComponent.extSrcList.BOX),
      ...externalType(BlockComponent.extSrcList.ONEDRIVE),
      ...externalType(BlockComponent.extSrcList.HUDDLE),
    };
    types[type]();
  }
}
SourceBtn.template = /*html*/ `
<uc-icon set="@name: iconName"></uc-icon>
<div .txt l10n="src-type"></div>
`;
SourceBtn.bindAttributes({
  type: null,
});
