import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class CameraSource extends BlockComponent {

  constructor() {
    super();
    this.initLocalState({
      video: null,
      'on.cancel': () => {
        this.pub('external', 'modalActive', false);
        this.pub('external', 'currentActivity', '');
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
    this.pub('local', 'video', this._stream);
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
      this.uploadCollection.add({
        file,
        fileName: name,
        fileSize: file.size,
        isImage: true,
        mimeType: file.type,
      });
      this.multiPub('external', {
        currentActivity: 'upload-list',
      });
    });
  }

  initCallback() {
    this.sub('external', 'currentActivity', (val) => {
      if (val === 'camera') {
        this._init();
      } else {
        this._stream?.getTracks()[0].stop();
        this.pub('local', 'video', null);
      }
    });
  }
}

CameraSource.template = /*html*/ `
<video 
  autoplay 
  playsinline 
  loc="srcObject: video"
  ref="video">
</video>
<div .toolbar>
  <button .cancel-btn loc="onclick: on.cancel" l10n="cancel"></button>
  <button .shot-btn loc="onclick: on.shot" l10n="camera-shot"></button>
</div>
`;