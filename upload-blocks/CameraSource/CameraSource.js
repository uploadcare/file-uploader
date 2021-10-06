import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class CameraSource extends BlockComponent {
  init$ = {
    video: null,
    onCancel: () => {
      this.set$({
        '*modalActive': false,
        '*currentActivity': '',
      });
    },
    onShot: () => {
      this._shot();
    },
  };

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
    this.$.video = this._stream;
  }

  _shot() {
    this._canvas.height = this.ref.video['videoHeight'];
    this._canvas.width = this.ref.video['videoWidth'];
    // @ts-ignore
    this._ctx.drawImage(this.ref.video, 0, 0);
    let date = Date.now();
    let name = `camera-${date}.png`;
    this._canvas.toBlob((blob) => {
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
      this.set$({
        '*currentActivity': 'upload-list',
      });
    });
  }

  initCallback() {
    this.sub('*currentActivity', (val) => {
      if (val === 'camera') {
        this._init();
      } else {
        this._stream?.getTracks()[0].stop();
        this.$.video = null;
      }
    });
  }
}

CameraSource.template = /*html*/ `
<video 
  autoplay 
  playsinline 
  set="srcObject: video"
  ref="video">
</video>
<div .toolbar>
  <button 
    .cancel-btn 
    set="onclick: onCancel" 
    l10n="cancel">
  </button>
  <button 
    .shot-btn 
    set="onclick: onShot" 
    l10n="camera-shot">
  </button>
</div>
`;
