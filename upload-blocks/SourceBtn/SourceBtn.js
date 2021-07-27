import { BaseComponent } from '../../symbiote/core/BaseComponent.js';
import { IconUi } from '../IconUi/IconUi.js';

IconUi.reg();

const ICONS = {
  default: 'M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z',
  local: 'M5,17L9.5,11L13,15.5L15.5,12.5L19,17M20,6H12L10,4H4A2,2 0 0,0 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8A2,2 0 0,0 20,6Z',
  url: 'M17.9,17.39C17.64,16.59 16.89,16 16,16H15V13A1,1 0 0,0 14,12H8V10H10A1,1 0 0,0 11,9V7H13A2,2 0 0,0 15,5V4.59C17.93,5.77 20,8.64 20,12C20,14.08 19.2,15.97 17.9,17.39M11,19.93C7.05,19.44 4,16.08 4,12C4,11.38 4.08,10.78 4.21,10.21L9,15V16A2,2 0 0,0 11,18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z',
  camera: 'M20,4H16.83L15,2H9L7.17,4H4A2,2 0 0,0 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6A2,2 0 0,0 20,4M20,18H4V6H8.05L9.88,4H14.12L15.95,6H20V18M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7M12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15Z',
  dots: 'M16,12A2,2 0 0,1 18,10A2,2 0 0,1 20,12A2,2 0 0,1 18,14A2,2 0 0,1 16,12M10,12A2,2 0 0,1 12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12M4,12A2,2 0 0,1 6,10A2,2 0 0,1 8,12A2,2 0 0,1 6,14A2,2 0 0,1 4,12Z',
};

export class SourceBtn extends BaseComponent {

  constructor() {
    super();
    this.initLocalState({
      path: ICONS.default,
    });
  }

  readyCallback() {
    this.setAttribute('role', 'button');
    this._setType(this._type);
  }

  _setType(type) {
    let types = {
      local: () => {
        this.localState.pub('path', ICONS.local);
        this.onclick = () => {
          this.externalState.multiPub({
            modalActive: false,
            currentActivity: 'upload-list',
            modalCaption: 'Selected',
            modalIcon: ICONS.local,
          });
          if (!this.externalState.read('files')?.length) {
            this.externalState.pub('systemTrigger', {});
          } else {
            this.externalState.pub('modalActive', true);
          }
        };
      },
      url: () => {
        this.localState.pub('path', ICONS.url);
        this.onclick = () => {
          this.externalState.multiPub({
            currentActivity: 'url',
            modalCaption: 'Import from external URL',
            modalIcon: ICONS.url,
            modalActive: true,
          });
        };
      },
      camera: () => {
        this.localState.pub('path', ICONS.camera);
        this.onclick = () => {
          this.externalState.multiPub({
            currentActivity: 'camera',
            modalCaption: 'Camera',
            modalIcon: ICONS.camera,
            modalActive: true,
          });
        };
      },
      other: () => {
        this.localState.pub('path', ICONS.dots);
        this.onclick = () => {
          this.externalState.multiPub({
            currentActivity: 'external',
            modalCaption: 'Other sources',
            modalIcon: ICONS.dots,
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
<icon-ui loc="@path: path"></icon-ui>
<div -txt-></div>
`;
SourceBtn.bindAttributes({
  type: ['property'],
});