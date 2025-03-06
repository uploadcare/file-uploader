// @ts-check
import { Block } from '../../abstract/Block.js';
import { stringToArray } from '../../utils/stringToArray.js';
import { calcCameraModes } from '../CameraSource/calcCameraModes.js';
import { isMobileDevice } from '../utils/checkDevice.js';

const getMobileStatus = () => isMobileDevice();

export class SourceList extends Block {
  initCallback() {
    super.initCallback();

    this.subConfigValue('sourceList', (/** @type {String} */ val) => {
      let list = stringToArray(val);
      let html = '';

      list.forEach((srcName) => {
        if (srcName === 'instagram') {
          console.error(
            "Instagram source was removed because the Instagram Basic Display API hasn't been available since December 4, 2024. " +
              'Official statement, see here:' +
              'https://developers.facebook.com/blog/post/2024/09/04/update-on-instagram-basic-display-api/?locale=en_US',
          );
          return;
        }

        if (srcName === 'camera' && getMobileStatus()) {
          const { isPhotoEnabled, isVideoRecordingEnabled } = calcCameraModes(this.cfg);

          if (isPhotoEnabled)
            html += /* HTML */ `<uc-source-btn role="listitem" type="mobile-photo-camera"></uc-source-btn>`;

          if (isVideoRecordingEnabled)
            html += /* HTML */ `<uc-source-btn role="listitem" type="mobile-video-camera"></uc-source-btn>`;

          return;
        }

        html += /* HTML */ `<uc-source-btn role="listitem" type="${srcName}"></uc-source-btn>`;
      });

      if (this.cfg.sourceListWrap) {
        this.innerHTML = html;
      } else {
        this.outerHTML = html;
      }
    });
  }
}
