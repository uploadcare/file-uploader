import { BaseComponent } from '../../symbiote/core/BaseComponent.js';

export class SourceBtn extends BaseComponent {

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
    let types = {
      local: () => {
        this.localState.pub('iconName', 'local');
        this.onclick = () => {
          this.externalState.multiPub({
            modalActive: false,
            currentActivity: 'upload-list',
            modalCaption: 'Selected',
            modalIcon: 'local',
          });
          if (!this.externalState.read('files')?.length) {
            this.externalState.pub('systemTrigger', {});
          } else {
            this.externalState.pub('modalActive', true);
          }
        };
      },
      url: () => {
        this.localState.pub('iconName', 'url');
        this.onclick = () => {
          this.externalState.multiPub({
            currentActivity: 'url',
            modalCaption: 'Import from external URL',
            modalIcon: 'url',
            modalActive: true,
          });
        };
      },
      camera: () => {
        this.localState.pub('iconName', 'camera');
        this.onclick = () => {
          this.externalState.multiPub({
            currentActivity: 'camera',
            modalCaption: 'Camera',
            modalIcon: 'camera',
            modalActive: true,
          });
        };
      },
      other: () => {
        this.localState.pub('iconName', 'dots');
        this.onclick = () => {
          this.externalState.multiPub({
            currentActivity: 'external',
            modalCaption: 'Other sources',
            modalIcon: 'dots',
            modalActive: true,
          });
        };
      },
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
<div -txt-></div>
`;
SourceBtn.bindAttributes({
  type: ['property'],
});