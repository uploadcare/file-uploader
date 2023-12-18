import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { canUsePermissionsApi } from '../utils/abilities.js';
import { debounce } from '../utils/debounce.js';
import { UploadSource } from '../utils/UploadSource.js';

export class CameraSource extends UploaderBlock {
  couldBeCtxOwner = true;
  activityType = ActivityBlock.activities.CAMERA;

  /** @private */
  _unsubPermissions = null;

  init$ = {
    ...this.init$,
    video: null,
    videoTransformCss: null,
    shotBtnDisabled: true,
    videoHidden: true,
    messageHidden: true,
    requestBtnHidden: canUsePermissionsApi(),
    l10nMessage: null,
    originalErrorMessage: null,
    cameraSelectOptions: null,
    cameraSelectHidden: true,

    onCameraSelectChange: (e) => {
      /** @type {String} */
      this._selectedCameraId = e.target.value;
      this._capture();
    },
    onCancel: () => {
      this.historyBack();
    },
    onShot: () => {
      this._shot();
    },
    onRequestPermissions: () => {
      this._capture();
    },
  };

  /** @private */
  _onActivate = () => {
    if (canUsePermissionsApi()) {
      this._subscribePermissions();
    }
    this._capture();
  };

  /** @private */
  _onDeactivate = () => {
    if (this._unsubPermissions) {
      this._unsubPermissions();
    }

    this._stopCapture();
  };

  /** @private */
  _handlePermissionsChange = () => {
    this._capture();
  };

  /**
   * @private
   * @param {'granted' | 'denied' | 'prompt'} state
   */
  _setPermissionsState = debounce((state) => {
    this.$.originalErrorMessage = null;
    this.classList.toggle('initialized', state === 'granted');

    if (state === 'granted') {
      this.set$({
        videoHidden: false,
        shotBtnDisabled: false,
        messageHidden: true,
      });
    } else if (state === 'prompt') {
      this.$.l10nMessage = this.l10n('camera-permissions-prompt');
      this.set$({
        videoHidden: true,
        shotBtnDisabled: true,
        messageHidden: false,
      });
      this._stopCapture();
    } else {
      this.$.l10nMessage = this.l10n('camera-permissions-denied');

      this.set$({
        videoHidden: true,
        shotBtnDisabled: true,
        messageHidden: false,
      });
      this._stopCapture();
    }
  }, 300);

  /** @private */
  async _subscribePermissions() {
    try {
      // @ts-ignore
      let permissionsResponse = await navigator.permissions.query({ name: 'camera' });
      permissionsResponse.addEventListener('change', this._handlePermissionsChange);
    } catch (err) {
      console.log('Failed to use permissions API. Fallback to manual request mode.', err);
      this._capture();
    }
  }

  /** @private */
  async _capture() {
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
    if (this._selectedCameraId) {
      constr.video.deviceId = {
        exact: this._selectedCameraId,
      };
    }
    /** @private */
    this._canvas = document.createElement('canvas');
    /** @private */
    this._ctx = this._canvas.getContext('2d');

    try {
      this._setPermissionsState('prompt');
      let stream = await navigator.mediaDevices.getUserMedia(constr);
      stream.addEventListener('inactive', () => {
        this._setPermissionsState('denied');
      });
      this.$.video = stream;
      /** @private */
      this._capturing = true;
      this._setPermissionsState('granted');
    } catch (err) {
      this._setPermissionsState('denied');
      this.$.originalErrorMessage = err.message;
    }
  }

  /** @private */
  _stopCapture() {
    if (this._capturing) {
      this.$.video?.getTracks()[0].stop();
      this.$.video = null;
      this._capturing = false;
    }
  }

  /** @private */
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
      this.addFileFromObject(file, { source: UploadSource.CAMERA });
      this.set$({
        '*currentActivity': ActivityBlock.activities.UPLOAD_LIST,
      });
    });
  }

  async initCallback() {
    super.initCallback();
    this.registerActivity(this.activityType, {
      onActivate: this._onActivate,
      onDeactivate: this._onDeactivate,
    });

    this.subConfigValue('cameraMirror', (val) => {
      this.$.videoTransformCss = val ? 'scaleX(-1)' : null;
    });

    try {
      let deviceList = await navigator.mediaDevices.enumerateDevices();
      let cameraSelectOptions = deviceList
        .filter((info) => {
          return info.kind === 'videoinput';
        })
        .map((info, idx) => {
          return {
            text: info.label.trim() || `${this.l10n('caption-camera')} ${idx + 1}`,
            value: info.deviceId,
          };
        });
      if (cameraSelectOptions.length > 1) {
        this.$.cameraSelectOptions = cameraSelectOptions;
        this.$.cameraSelectHidden = false;
      }
    } catch (err) {
      // mediaDevices isn't available for HTTP
      // TODO: handle this case
    }
  }
}

CameraSource.template = /* HTML */ `
  <lr-activity-header>
    <button type="button" class="mini-btn" set="onclick: *historyBack">
      <lr-icon name="back"></lr-icon>
    </button>
    <div set="@hidden: !cameraSelectHidden">
      <lr-icon name="camera"></lr-icon>
      <span l10n="caption-camera"></span>
    </div>
    <lr-select
      class="camera-select"
      set="$.options: cameraSelectOptions; @hidden: cameraSelectHidden; onchange: onCameraSelectChange"
    >
    </lr-select>
    <button type="button" class="mini-btn close-btn" set="onclick: *closeModal">
      <lr-icon name="close"></lr-icon>
    </button>
  </lr-activity-header>
  <div class="content">
    <video
      autoplay
      playsinline
      set="srcObject: video; style.transform: videoTransformCss; @hidden: videoHidden"
      ref="video"
    ></video>
    <div class="message-box" set="@hidden: messageHidden">
      <span>{{l10nMessage}}</span>
      <span>{{originalErrorMessage}}</span>
      <button
        type="button"
        set="onclick: onRequestPermissions; @hidden: requestBtnHidden"
        l10n="camera-permissions-request"
      ></button>
    </div>
    <button type="button" class="shot-btn" set="onclick: onShot; @disabled: shotBtnDisabled">
      <lr-icon name="camera"></lr-icon>
    </button>
  </div>
`;
