import { BlockComponent } from '../BlockComponent/BlockComponent.js';
import { EXTERNAL_SOURCE } from '../dictionary.js';

export class SourceBtn extends BlockComponent {
  constructor() {
    super();
    this.initLocalState({
      iconName: 'default',
    });
  }

  initCallback() {
    this.setAttribute('role', 'button');
    this._setType(this._type);
  }

  _setType(type) {
    let externalType = (type) => ({
      [type]: () => {
        this.applyL10nKey('src-type', `src-type-${type}`);
        window.setTimeout(() => {
          if (this.blockRegistry['external-source']) {
            this.pub('local', 'iconName', type);
            this.onclick = () => {
              this.multiPub('external', {
                externalSourceType: type,
                currentActivity: 'external',
                modalCaption: `${type[0].toUpperCase()}${type.slice(1)}`,
                modalIcon: type,
                modalActive: true,
              });
            };
          } else {
            this.style.display = 'none';
          }
        });
      },
    });

    let types = {
      local: () => {
        this.applyL10nKey('src-type', 'src-type-local');
        this.pub('local', 'iconName', 'local');
        this.onclick = () => {
          this.multiPub('external', {
            modalActive: false,
            currentActivity: 'upload-list',
            modalCaption: 'Selected',
            modalIcon: 'local',
          });
          if (!this.read('external', 'files')?.length) {
            this.openSystemDialog();
          } else {
            this.pub('external', 'modalActive', true);
          }
        };
      },
      url: () => {
        this.applyL10nKey('src-type', 'src-type-from-url');
        this.pub('local', 'iconName', 'url');
        this.onclick = () => {
          this.multiPub('external', {
            currentActivity: 'url',
            modalCaption: 'Import from external URL',
            modalIcon: 'url',
            modalActive: true,
          });
        };
      },
      camera: () => {
        this.applyL10nKey('src-type', 'src-type-camera');
        window.setTimeout(() => {
          if (this.blockRegistry['camera-source']) {
            this.pub('local', 'iconName', 'camera');
            this.onclick = () => {
              this.multiPub('external', {
                currentActivity: 'camera',
                modalCaption: 'Camera',
                modalIcon: 'camera',
                modalActive: true,
              });
            };
          } else {
            this.style.display = 'none';
          }
        });
      },
      draw: () => {
        this.applyL10nKey('src-type', 'src-type-draw');
        this.pub('local', 'iconName', 'edit-draw');
        this.onclick = () => {
          this.multiPub('external', {
            currentActivity: 'draw',
            modalCaption: 'Draw',
            modalIcon: 'edit-draw',
            modalActive: true,
          });
        };
      },
      other: () => {
        this.applyL10nKey('src-type', 'src-type-other');
        this.pub('local', 'iconName', 'dots');
        this.onclick = () => {
          this.multiPub('external', {
            currentActivity: 'external',
            modalCaption: 'Other sources',
            modalIcon: 'dots',
            modalActive: true,
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

  set type(val) {
    if (!val) {
      return;
    }
    this._type = val;
  }
}
SourceBtn.template = /*html*/ `
<icon-ui loc="@name: iconName"></icon-ui>
<div .txt l10n="src-type"></div>
`;
SourceBtn.bindAttributes({
  type: ['property'],
});
