import { Block } from '../../abstract/Block.js';
import { canUsePermissionsApi } from '../utils/abilities.js';
import { debounce } from '../utils/debounce.js';

/**
 * @typedef {Object} State
 * @property {any} video
 * @property {String} videoTransformCss
 * @property {Boolean} shotBtnDisabled
 * @property {Boolean} videoHidden
 * @property {Boolean} messageHidden
 * @property {Boolean} requestBtnHidden
 * @property {String} l10nMessage
 * @property {() => void} onCancel
 * @property {() => void} onShot
 * @property {() => void} onRequestPermissions
 */

/**
 * @extends {Block<
 *   State &
 *     Partial<
 *       import('../ActivityIcon/ActivityIcon.js').State &
 *         import('../ActivityCaption/ActivityCaption.js').State &
 *         import('../../abstract/Block.js').BlockState
 *     >
 * >}
 */
export class CameraSource extends Block {
  activityType = Block.activities.CAMERA;

  /** @private */
  _unsubPermissions = null;

  /** @type {State} */
  init$ = {
    video: null,
    videoTransformCss: null,
    shotBtnDisabled: false,
    videoHidden: false,
    messageHidden: true,
    requestBtnHidden: canUsePermissionsApi(),
    l10nMessage: null,

    onCancel: () => {
      this.cancelFlow();
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
    this.set$({
      '*activityCaption': this.l10n('caption-camera'),
      '*activityIcon': 'camera',
    });

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
      this.uploadCollection.add({
        file,
        fileName: name,
        fileSize: file.size,
        isImage: true,
        mimeType: file.type,
      });
      this.set$({
        '*currentActivity': Block.activities.UPLOAD_LIST,
      });
    });
  }

  initCallback() {
    this.registerActivity(this.activityType, this._onActivate, this._onDeactivate);

    let camMirrProp = this.bindCssData('--cfg-camera-mirror');
    this.sub(camMirrProp, (val) => {
      if (!this.isActivityActive) {
        return;
      }
      this.$.videoTransformCss = val ? 'scaleX(-1)' : null;
    });
  }
}

CameraSource.template = /*html*/ `
<div class="content">
  <video
    autoplay
    playsinline
    set="srcObject: video; style.transform: videoTransformCss; @hidden: videoHidden"
    ref="video">
  </video>
  <div class="message-box" set="@hidden: messageHidden">
    <span>{{l10nMessage}}</span>
    <button set="onclick: onRequestPermissions; @hidden: requestBtnHidden" l10n="camera-permissions-request"></button>
  </div>
</div>

<div class="toolbar">
  <button
    class="cancel-btn secondary-btn"
    set="onclick: onCancel"
    l10n="cancel">
  </button>
  <button
    class="shot-btn primary-btn"
    set="onclick: onShot; @disabled: shotBtnDisabled"
    l10n="camera-shot">
  </button>
</div>
`;
