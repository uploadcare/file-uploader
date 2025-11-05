import { html } from '@symbiotejs/symbiote';
import { Block } from '../../abstract/Block';
import { browserFeatures } from '../../utils/browser-info';
import { deserializeCsv } from '../../utils/comma-separated';
import { stringToArray } from '../../utils/stringToArray';

export class SourceList extends Block {
  override initCallback(): void {
    super.initCallback();

    this.subConfigValue('sourceList', (val: string) => {
      const list = stringToArray(val);
      let htmlContent = '';

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
              htmlContent += html`<uc-source-btn role="listitem" type="mobile-${mode}-camera"></uc-source-btn>`;
            });

            if (cameraModes.length === 0) {
              htmlContent += html`<uc-source-btn role="listitem" type="mobile-photo-camera"></uc-source-btn>`;
            }
          });

          return;
        }

        htmlContent += html`<uc-source-btn role="listitem" type="${srcName}"></uc-source-btn>`;
      });

      if (this.cfg.sourceListWrap) {
        this.innerHTML = htmlContent;
      } else {
        this.outerHTML = htmlContent;
      }
    });
  }
}
