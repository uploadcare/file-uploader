import { Block } from '../../abstract/Block';
import { browserFeatures } from '../../utils/browser-info';
import { deserializeCsv } from '../../utils/comma-separated';
import { stringToArray } from '../../utils/stringToArray';

export class SourceList extends Block {
  override initCallback(): void {
    super.initCallback();

    this.subConfigValue('sourceList', (val: string) => {
      const list = stringToArray(val);
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

        if (srcName === 'camera' && browserFeatures.htmlMediaCapture) {
          this.subConfigValue('cameraModes', (cameraModesValue: string) => {
            const cameraModes = deserializeCsv(cameraModesValue);

            cameraModes.forEach((mode) => {
              html += /* HTML */ `<uc-source-btn role="listitem" type="mobile-${mode}-camera"></uc-source-btn>`;
            });

            if (cameraModes.length === 0) {
              html += /* HTML */ `<uc-source-btn role="listitem" type="mobile-photo-camera"></uc-source-btn>`;
            }
          });

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
