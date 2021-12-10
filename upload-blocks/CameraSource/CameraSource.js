import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class CameraSource extends BlockComponent {
  activityType = BlockComponent.activities.CAMERA;

  init$ = {
    video: null,
    videoTransformCss: null,
    onCancel: () => {
      this.set$({
        '*currentActivity': BlockComponent.activities.SOURCE_SELECT,
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
    this._initialized = true;
  }

  _deInit() {
    if (this._initialized) {
      this._stream?.getTracks()[0].stop();
      this.$.video = null;
      this._initialized = false;
    }
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
        '*currentActivity': BlockComponent.activities.UPLOAD_LIST,
      });
    });
  }

  initCallback() {
    this.registerActivity(this.activityType, () => {
      this.set$({
        videoTransformCss: this.cfg('camera-mirror') ? 'scaleX(-1)' : null,
        '*modalCaption': this.l10n('caption-camera'),
        '*modalIcon': 'camera',
      });
      this._init();
    });
    this.sub('*currentActivity', (val) => {
      if (val !== this.activityType) {
        this._deInit();
      }
    });
  }
}

CameraSource.template = /*html*/ `
<video
  autoplay
  playsinline
  set="srcObject: video; style.transform: videoTransformCss"
  ref="video">
</video>

<div class="toolbar">
  <button
    class="cancel-btn secondary-btn"
    set="onclick: onCancel"
    l10n="cancel">
  </button>
  <button
    class="shot-btn primary-btn"
    set="onclick: onShot"
    l10n="camera-shot">
  </button>
</div>
`;
