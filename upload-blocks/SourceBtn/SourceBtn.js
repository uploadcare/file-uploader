import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { EXTERNAL_SOURCE } from '../dictionary.js';

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
            '*currentActivity': 'external',
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
            '*currentActivity': 'upload-list',
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
            '*currentActivity': 'url',
            '*modalCaption': 'Import from external URL',
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
            '*currentActivity': 'camera',
            '*modalCaption': 'Camera',
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
            '*currentActivity': 'draw',
            '*modalCaption': 'Draw',
            '*modalIcon': 'edit-draw',
            '*modalActive': true,
          });
        };
      },
      other: () => {
        this.applyL10nKey('src-type', 'src-type-other');
        this.$.iconName = 'dots';
        this.onclick = () => {
          this.set$({
            '*currentActivity': 'external',
            '*modalCaption': 'Other sources',
            '*modalIcon': 'dots',
            '*modalActive': true,
          });
        };
      },
      ...externalType(EXTERNAL_SOURCE.INSTAGRAM),
      ...externalType(EXTERNAL_SOURCE.FACEBOOK),
      ...externalType(EXTERNAL_SOURCE.DROPBOX),
      ...externalType(EXTERNAL_SOURCE.GDRIVE),
      ...externalType(EXTERNAL_SOURCE.GPHOTOS),
      ...externalType(EXTERNAL_SOURCE.INSTAGRAM),
      ...externalType(EXTERNAL_SOURCE.FLICKR),
      ...externalType(EXTERNAL_SOURCE.VK),
      ...externalType(EXTERNAL_SOURCE.EVERNOTE),
      ...externalType(EXTERNAL_SOURCE.BOX),
      ...externalType(EXTERNAL_SOURCE.ONEDRIVE),
      ...externalType(EXTERNAL_SOURCE.HUDDLE),
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
