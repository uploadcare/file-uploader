import { BaseComponent } from '../../symbiote/core/BaseComponent.js';

export class CameraSource extends BaseComponent {

  constructor() {
    super();
    this.initLocalState({
      video: null,
      'on.cancel': () => {
        this.externalState.pub('modalActive', false);
        this.externalState.pub('currentActivity', '');
      },
      'on.shot': () => {
        this._shot();
      },
    });
  }

  async _init() {
    let constr = {
      video: {
        width: {
          ideal: 1920,
        },
        height: {
          ideal: 1080,
        },
        frameRate: {
          ideal: 30,
        },
      },
      audio: false,
    };
    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d');
    this._stream = await navigator.mediaDevices.getUserMedia(constr);
    this.localState.pub('video', this._stream);
  }

  _shot() {
    this._canvas.height = this.ref.video['videoHeight'];
    this._canvas.width = this.ref.video['videoWidth'];
    // @ts-ignore
    this._ctx.drawImage(this.ref.video, 0, 0);
    let date = Date.now();
    let name = `camera-${date}.png`;
    this._canvas.toBlob(async (blob) => {
      let file = new File([blob], name, {
        lastModified: date,
        type: 'image/png',
      });
      this.externalState.multiPub({
        focusedFile: file,
        modalCaption: `Edit file ${name}`,
        currentActivity: 'pre-edit',
      });
    });
  }

  initCallback() {
    this.externalState.sub('currentActivity', (val) => {
      if (val === 'camera') {
        this._init();
      } else {
        this._stream?.getTracks()[0].stop();
        this.localState.pub('video', null);
      }
    });
  }
}

CameraSource.template = /*html*/ `
<video 
  autoplay 
  playsinline 
  loc="srcObject: video"
  ref="video"></video>
<div -toolbar->
  <button -cancel-btn- loc="onclick: on.cancel"></button>
  <button -shot-btn- loc="onclick: on.shot"></button>
</div>
`;